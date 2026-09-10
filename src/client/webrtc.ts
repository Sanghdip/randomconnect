export type Signaler = (payload: any) => void;

export class WebRTCManager {
  pc?: RTCPeerConnection;
  localStream?: MediaStream;
  screenStream?: MediaStream;
  remoteStream = new MediaStream();
  private sendSignal: Signaler;
  private peerId = "";
  private remoteVideo: HTMLVideoElement;
  private localVideo: HTMLVideoElement;

  constructor(localVideo: HTMLVideoElement, remoteVideo: HTMLVideoElement, sendSignal: Signaler) {
    this.localVideo = localVideo;
    this.remoteVideo = remoteVideo;
    this.sendSignal = sendSignal;
  }

  async start(peerId: string, iceServers: RTCIceServer[] = []) {
    this.peerId = peerId;
    this.pc?.close();
    this.pc = new RTCPeerConnection({ iceServers });
    this.remoteStream = new MediaStream();
    this.remoteVideo.srcObject = this.remoteStream;

    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.sendSignal({ type: "ice_candidate", peerId: this.peerId, candidate: e.candidate });
    };
    this.pc.ontrack = (e) => {
      for (const track of e.streams[0]?.getTracks() || [e.track]) {
        if (!this.remoteStream.getTracks().find(t => t.id === track.id)) this.remoteStream.addTrack(track);
      }
      this.remoteVideo.play().catch(() => {});
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === "failed") this.pc.restartIce();
    };

    if (!this.localStream) {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.localVideo.srcObject = this.localStream;
      for (const track of this.localStream.getTracks()) this.pc.addTrack(track, this.localStream);
    }
  }

  async createOffer() {
    if (!this.pc) throw new Error("WebRTC is not started");
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignal({ type: "webrtc_offer", peerId: this.peerId, offer });
  }

  async acceptOffer(offer: RTCSessionDescriptionInit) {
    if (!this.pc) await this.start(this.peerId);
    await this.pc!.setRemoteDescription(offer);
    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);
    this.sendSignal({ type: "webrtc_answer", peerId: this.peerId, answer });
  }

  async acceptAnswer(answer: RTCSessionDescriptionInit) {
    await this.pc?.setRemoteDescription(answer);
  }

  async addCandidate(candidate: RTCIceCandidateInit) {
    try { await this.pc?.addIceCandidate(candidate); } catch {}
  }

  async toggleMic() {
    this.localStream?.getAudioTracks().forEach(t => t.enabled = !t.enabled);
  }

  async toggleCamera() {
    this.localStream?.getVideoTracks().forEach(t => t.enabled = !t.enabled);
  }

  async shareScreen() {
    if (!this.pc) throw new Error("Call not started");
    if (this.screenStream) return;
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).catch(() => undefined);
    if (!this.screenStream) return;
    const screenTrack = this.screenStream.getVideoTracks()[0];
    const sender = this.pc.getSenders().find(s => s.track?.kind === "video");
    if (sender) await sender.replaceTrack(screenTrack);
    screenTrack.onended = () => this.stopScreenShare().catch(() => {});
  }

  async stopScreenShare() {
    const cameraTrack = this.localStream?.getVideoTracks()[0];
    const sender = this.pc?.getSenders().find(s => s.track?.kind === "video");
    if (sender && cameraTrack) await sender.replaceTrack(cameraTrack);
    this.screenStream?.getTracks().forEach(t => t.stop());
    this.screenStream = undefined;
  }

  end() {
    this.screenStream?.getTracks().forEach(t => t.stop());
    this.localStream?.getTracks().forEach(t => t.stop());
    this.pc?.close();
    this.pc = undefined;
    this.remoteStream = new MediaStream();
    this.remoteVideo.srcObject = this.remoteStream;
  }
}
