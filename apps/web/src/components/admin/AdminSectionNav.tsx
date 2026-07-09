"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AdminSectionNav.module.css";

const SECTIONS = [
  { label: "신고 관리", href: "/admin/reports" },
  { label: "유저 관리", href: "/admin/users" },
  { label: "거래 내역", href: "/admin/transactions" },
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
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
