import React from 'react';

/**
 * Đã hợp nhất vào AuthModal tại Root level (App.tsx) để tránh lỗi trùng lặp modals (Duplicate Modals).
 * File này được giữ lại dưới dạng Null Component để tránh gãy imports cũ nếu có.
 */
export const FirstTimeLoginModal: React.FC<any> = () => null;
export default FirstTimeLoginModal;
