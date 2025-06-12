"use client";

/**
 * Stores the user ID in localStorage for presence tracking
 * This is called on the client side after successful authentication
 */
export function storeUserId(userId: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('userId', userId);
  }
}
