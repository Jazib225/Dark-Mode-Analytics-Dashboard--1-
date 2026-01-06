import { X } from "lucide-react";

interface PnLCalendarProps {
  onClose: () => void;
}

const calendarData = [
  { day: 1, pnl: 1200 },
  { day: 2, pnl: 2400 },
  { day: 3, pnl: 1700 },
  { day: 4, pnl: 1600 },
  { day: 5, pnl: 1400 },
  { day: 6, pnl: -800 },
  { day: 7, pnl: 900 },
  { day: 8, pnl: 1100 },
  { day: 9, pnl: 1800 },
  { day: 10, pnl: -500 },
  { day: 11, pnl: 2200 },
  { day: 12, pnl: 1500 },
  { day: 13, pnl: 1900 },
  { day: 14, pnl: 1300 },
  { day: 15, pnl: -600 },
  { day: 16, pnl: 1700 },
  { day: 17, pnl: 2100 },
  { day: 18, pnl: 1400 },
  { day: 19, pnl: 1600 },
  { day: 20, pnl: 1200 },
  { day: 21, pnl: -400 },
  { day: 22, pnl: 1800 },
  { day: 23, pnl: 2000 },
  { day: 24, pnl: 1500 },
  { day: 25, pnl: 1700 },
  { day: 26, pnl: 1900 },
  { day: 27, pnl: -700 },
  { day: 28, pnl: 1300 },
  { day: 29, pnl: 1600 },
  { day: 30, pnl: 1800 },
  { day: 31, pnl: 2200 },
];

export function PnLCalendar({ onClose }: PnLCalendarProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#0d0d0d] border border-gray-800 p-6 max-w-2xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm text-gray-400 uppercase tracking-wider">January 2026 PnL</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-xs text-gray-600 pb-2">
              {day}
            </div>
          ))}

          {/* Padding for first day of month (assuming Jan 1 is Wednesday) */}
          <div></div>
          <div></div>
          <div></div>

          {calendarData.map((data) => (
            <div
              key={data.day}
              className={`border ${
                data.pnl > 0
                  ? "border-green-800/30 bg-green-950/20"
                  : "border-red-800/30 bg-red-950/20"
              } p-2 text-center`}
            >
              <div className="text-xs text-gray-500 mb-1">{data.day}</div>
              <div
                className={`text-xs ${data.pnl > 0 ? "text-green-500" : "text-red-500"}`}
              >
                {data.pnl > 0 ? "+" : ""}${data.pnl}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between text-xs">
          <div className="text-gray-500">Total for January</div>
          <div className="text-green-500">+$43,700</div>
        </div>
      </div>
    </div>
  );
}
