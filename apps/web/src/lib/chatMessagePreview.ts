import type { ChatMessageDto } from "@secondhand/types";

// `content` on a TRANSFER message is a static snapshot written at send time
// ("5,000원을 보냈습니다") and never updated — the room list's one-line
// preview has to read the message's *current* status instead, or a
// rejected-and-refunded transfer would sit there looking like an
// still-open/normal send forever.
export function formatMessagePreview(message: ChatMessageDto, isOwn: boolean): string {
  if (message.type !== "TRANSFER") return message.content;

  const amountText = `${(message.amount ?? 0).toLocaleString()}원`;
  switch (message.transactionStatus) {
    case "PENDING":
      return isOwn ? `${amountText} 송금 대기중` : `${amountText} 받기 대기중`;
    case "REJECTED":
      return isOwn ? `${amountText} 거절되어 환불됨` : `${amountText} 거절함`;
    default:
      return `${amountText} ${isOwn ? "보냄" : "받음"}`;
  }
}
