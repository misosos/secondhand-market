"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import { ChatWindow } from "./ChatWindow";

interface ChatEntryButtonProps {
  peerId: string;
  peerUsername: string;
  label?: string;
}

export function ChatEntryButton({ peerId, peerUsername, label = "판매자와 채팅하기" }: ChatEntryButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        {label}
      </Button>
      {isOpen && <ChatWindow peerId={peerId} peerUsername={peerUsername} onClose={() => setIsOpen(false)} />}
    </>
  );
}
