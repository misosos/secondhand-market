"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, Receipt, Users } from "lucide-react";
import styles from "./AdminSectionNav.module.css";

const SECTIONS = [
  { label: "신고 관리", href: "/admin/reports", icon: Flag },
  { label: "유저 관리", href: "/admin/users", icon: Users },
  { label: "거래 내역", href: "/admin/transactions", icon: Receipt },
];

export function AdminSectionNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      {SECTIONS.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          className={`${styles.link} ${pathname === section.href ? styles.linkActive : ""}`}
        >
          <section.icon size={14} strokeWidth={2.25} aria-hidden />
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
