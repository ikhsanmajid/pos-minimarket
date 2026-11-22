import { useTheme } from "@/context/ThemeContext";
import React from "react";
import { ToastContainer } from "react-toastify";


export default function MainLayout({ children }: { children: React.ReactNode }) {
    const { theme: tema } = useTheme();

    return (
        <>
            {children}
            <ToastContainer theme={tema} />
        </>

    )
}