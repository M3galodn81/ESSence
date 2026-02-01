import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DURATION_MS = 3000; // 5 seconds in milliseconds

export default function ManagerQRPage() {
  const [qrValue, setQrValue] = useState("");
  const [expiry, setExpiry] = useState(Date.now() + DURATION_MS);
  const [remaining, setRemaining] = useState(DURATION_MS);

  // Function to refresh token and reset the clock
  const refreshScanner = useCallback(() => {
    setQrValue(`attendance-token-${Date.now()}`);
    const newExpiry = Date.now() + DURATION_MS;
    setExpiry(newExpiry);
  }, []);

  useEffect(() => {
    refreshScanner();

    const timer = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, expiry - now);
      
      if (diff <= 0) {
        refreshScanner();
      } else {
        setRemaining(diff);
      }
    }, 10); // Update every 10ms for 60fps smoothness

    return () => clearInterval(timer);
  }, [expiry, refreshScanner]);

  // Calculations for UI
  const secondsLeft = (remaining / 1000).toFixed(2);
  const progressWidth = (remaining / DURATION_MS) * 100;

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-md text-center p-6 rounded-[2.5rem] shadow-2xl bg-white">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-slate-800">Scan to Clock In</CardTitle>
          <p className="text-slate-500 font-medium">Dynamic Security QR</p>
        </CardHeader>
        
        <CardContent className="flex flex-col items-center gap-8">
          {/* QR Container */}
          <div className="p-6 bg-slate-50 rounded-[2rem] border-4 border-white shadow-inner">
            <QRCodeSVG value={qrValue} size={220} level="M" />
          </div>

          {/* Smooth Progress Section */}
          <div className="w-full space-y-4">
            <div className="flex justify-between items-center px-2">
              <span className="text-xs font-black uppercase tracking-tighter text-slate-400">Token Status</span>
              <span className="text-xl font-mono font-bold text-primary tabular-nums">
                {secondsLeft}s
              </span>
            </div>

            {/* The Bar */}
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all ease-linear"
                style={{ 
                  width: `${progressWidth}%`,
                  // We use ease-linear because the 10ms interval is so fast it looks fluid
                  transition: 'none' 
                }}
              />
            </div>

            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-300 font-mono">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              CONNECTED TO SECURE SERVER
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}