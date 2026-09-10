export type ClientMessage =
  | { type: "join_room"; roomId: string }
  | { type: "chat_message"; conversationId: string; body: string }
  | { type: "typing"; conversationId: string }
  | { type: "webrtc_offer"; roomId: string; sdp: RTCSessionDescriptionInit }
  | { type: "webrtc_answer"; roomId: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice_candidate"; roomId: string; candidate: RTCIceCandidateInit }
  | { type: "screen_share_started"; roomId: string }
  | { type: "screen_share_stopped"; roomId: string }
  | { type: "call_ended"; roomId: string };

export type ServerMessage =
  | { type: "room_joined"; roomId: string }
  | { type: "match_found"; conversationId: string; roomId: string; participant: { displayName: string } }
  | { type: "chat_message"; messageId: string; conversationId: string; senderId: string; body: string; createdAt: number }
  | { type: "typing"; conversationId: string; senderId: string }
  | { type: "webrtc_offer"; roomId: string; sdp: RTCSessionDescriptionInit }
  | { type: "webrtc_answer"; roomId: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice_candidate"; roomId: string; candidate: RTCIceCandidateInit }
  | { type: "screen_share_started"; roomId: string }
  | { type: "screen_share_stopped"; roomId: string }
  | { type: "call_ended"; roomId: string };
