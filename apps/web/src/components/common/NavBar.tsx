"use client";

import Link from "next/link";
import {
  LogIn,
  LogOut,
  MessageCircle,
  MessagesSquare,
  Package,
  PlusCircle,
  Receipt,
  ShieldCheck,
  UserCircle,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Role } from "@secondhand/types";
import { useAuth } from "@/features/auth/useAuth";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./NavBar.module.css";

export function NavBar() {
  const { user, isLoading, logout } = useAuth();

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.logo} aria-label="중고거래">
          <Logo size={32} />
        </Link>
        <div className={styles.right}>
          <nav className={styles.nav}>
            {!isLoading && user && (
              <>
                <Link href="/products/new">
                  <PlusCircle size={14} strokeWidth={2.25} aria-hidden />
                  상품 등록
                </Link>
                <Link href="/mypage/products">
                  <Package size={14} strokeWidth={2.25} aria-hidden />
                  내 상품
                </Link>
                <Link href="/chat">
                  <MessageCircle size={14} strokeWidth={2.25} aria-hidden />
                  채팅
                </Link>
                <Link href="/chat/global">
                  <MessagesSquare size={14} strokeWidth={2.25} aria-hidden />
                  전체채팅
                </Link>
                <Link href="/mypage/transactions">
                  <Receipt size={14} strokeWidth={2.25} aria-hidden />
                  거래내역
                </Link>
                <Link href="/mypage">
                  <UserCircle size={14} strokeWidth={2.25} aria-hidden />
                  마이페이지
                </Link>
                {user.role === Role.ADMIN && (
                  <Link href="/admin/reports">
                    <ShieldCheck size={14} strokeWidth={2.25} aria-hidden />
                    관리자
                  </Link>
                )}
                <span className={styles.balance}>
                  <Wallet size={14} strokeWidth={2.25} aria-hidden />
                  {user.balance.toLocaleString()}원
                </span>
                <button className={styles.logoutButton} onClick={() => logout()}>
                  <LogOut size={14} strokeWidth={2.25} aria-hidden />
                  로그아웃
                </button>
              </>
            )}
            {!isLoading && !user && (
              <>
                <Link href="/login">
                  <LogIn size={14} strokeWidth={2.25} aria-hidden />
                  로그인
                </Link>
                <Link href="/signup">
                  <UserPlus size={14} strokeWidth={2.25} aria-hidden />
                  회원가입
                </Link>
              </>
            )}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
