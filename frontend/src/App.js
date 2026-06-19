import { useEffect } from "react";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import CommandCenter from "@/pages/CommandCenter";

export default function App() {
  useEffect(() => {
    document.title = "Bengaluru Traffic Police · Congestion Intelligence Engine";
  }, []);
  return (
    <>
      <CommandCenter />
      <Toaster theme="light" position="top-right" richColors closeButton />
    </>
  );
}
