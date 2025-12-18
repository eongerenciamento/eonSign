import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { DayPicker, CaptionProps, useNavigation, DateRange } from "react-day-picker";
import { format, setMonth, setYear, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Context to pass selected days count to CustomCaption
const SelectedDaysContext = React.createContext<number>(0);

function MonthYearPicker({ 
  displayMonth, 
  onChange 
}: { 
  displayMonth: Date; 
  onChange: (date: Date) => void;
}) {
  const [selectedMonth, setSelectedMonth] = React.useState(displayMonth.getMonth());
  const [selectedYear, setSelectedYear] = React.useState(displayMonth.getFullYear());
  
  // Touch handling
  const monthTouchRef = React.useRef<{ startY: number; startMonth: number } | null>(null);
  const yearTouchRef = React.useRef<{ startY: number; startYear: number } | null>(null);
  
  // Throttle for smooth scrolling
  const wheelThrottleRef = React.useRef<boolean>(false);
  const wheelIntervalMs = 120;

  // Update parent when values change
  React.useEffect(() => {
    const newDate = setYear(setMonth(displayMonth, selectedMonth), selectedYear);
    onChange(newDate);
  }, [selectedMonth, selectedYear]);

  const handleMonthUp = () => {
    setSelectedMonth(prev => (prev + 1) % 12);
  };

  const handleMonthDown = () => {
    setSelectedMonth(prev => (prev - 1 + 12) % 12);
  };

  const handleYearUp = () => {
    setSelectedYear(prev => prev + 1);
  };

  const handleYearDown = () => {
    setSelectedYear(prev => prev - 1);
  };

  // Month touch handlers
  const handleMonthTouchStart = (e: React.TouchEvent) => {
    monthTouchRef.current = {
      startY: e.touches[0].clientY,
      startMonth: selectedMonth
    };
  };

  const handleMonthTouchMove = (e: React.TouchEvent) => {
    if (!monthTouchRef.current) return;
    const deltaY = monthTouchRef.current.startY - e.touches[0].clientY;
    const steps = Math.round(deltaY / 30);
    const newMonth = (monthTouchRef.current.startMonth + steps + 120) % 12;
    setSelectedMonth(newMonth);
  };

  const handleMonthTouchEnd = () => {
    monthTouchRef.current = null;
  };

  // Year touch handlers
  const handleYearTouchStart = (e: React.TouchEvent) => {
    yearTouchRef.current = {
      startY: e.touches[0].clientY,
      startYear: selectedYear
    };
  };

  const handleYearTouchMove = (e: React.TouchEvent) => {
    if (!yearTouchRef.current) return;
    const deltaY = yearTouchRef.current.startY - e.touches[0].clientY;
    const steps = Math.round(deltaY / 30);
    setSelectedYear(yearTouchRef.current.startYear + steps);
  };

  const handleYearTouchEnd = () => {
    yearTouchRef.current = null;
  };

  // Wheel handlers for desktop with throttling
  const handleMonthWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (wheelThrottleRef.current) return;
    
    if (e.deltaY < 0) handleMonthUp();
    else handleMonthDown();
    
    wheelThrottleRef.current = true;
    setTimeout(() => {
      wheelThrottleRef.current = false;
    }, wheelIntervalMs);
  };

  const handleYearWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (wheelThrottleRef.current) return;
    
    if (e.deltaY < 0) handleYearUp();
    else handleYearDown();
    
    wheelThrottleRef.current = true;
    setTimeout(() => {
      wheelThrottleRef.current = false;
    }, wheelIntervalMs);
  };

  return (
    <div className="flex items-center justify-center gap-8 p-4">
      {/* Month Spinner */}
      <div 
        className="flex flex-col items-center gap-1"
        onTouchStart={handleMonthTouchStart}
        onTouchMove={handleMonthTouchMove}
        onTouchEnd={handleMonthTouchEnd}
        onWheel={handleMonthWheel}
      >
        <button 
          type="button"
          onClick={handleMonthUp} 
          className="p-1 hover:bg-white/20 rounded-full transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <span className="w-24 text-center font-semibold text-foreground select-none">
          {months[selectedMonth]}
        </span>
        <button 
          type="button"
          onClick={handleMonthDown} 
          className="p-1 hover:bg-white/20 rounded-full transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Year Spinner */}
      <div 
        className="flex flex-col items-center gap-1"
        onTouchStart={handleYearTouchStart}
        onTouchMove={handleYearTouchMove}
        onTouchEnd={handleYearTouchEnd}
        onWheel={handleYearWheel}
      >
        <button 
          type="button"
          onClick={handleYearUp} 
          className="p-1 hover:bg-white/20 rounded-full transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <span className="w-16 text-center font-semibold text-foreground select-none">
          {selectedYear}
        </span>
        <button 
          type="button"
          onClick={handleYearDown} 
          className="p-1 hover:bg-white/20 rounded-full transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CustomCaption({ displayMonth }: CaptionProps) {
  const { goToMonth } = useNavigation();
  const [showPicker, setShowPicker] = React.useState(false);
  const pickerRef = React.useRef<HTMLDivElement>(null);
  const selectedDays = React.useContext(SelectedDaysContext);

  const handleChange = (newDate: Date) => {
    goToMonth(newDate);
  };

  // Close picker when clicking outside
  React.useEffect(() => {
    if (!showPicker) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPicker]);

  return (
    <div className="relative flex justify-center items-center">
      {showPicker && (
        <div 
          ref={pickerRef} 
          className="absolute top-full mt-2 z-50 bg-gray-500/20 dark:bg-gray-600/20 backdrop-blur-sm rounded-xl shadow-xl border border-white/20 p-2"
        >
          <MonthYearPicker displayMonth={displayMonth} onChange={handleChange} />
        </div>
      )}
      
      <div className="flex items-center gap-4">
        <div className="flex items-center">
          <span 
            onClick={() => setShowPicker(!showPicker)}
            className="text-sm font-semibold text-foreground hover:text-foreground/80 transition-colors cursor-pointer capitalize"
          >
            {format(displayMonth, "MMMM yyyy", { locale: ptBR })}
          </span>
        </div>
        
        <div className="flex items-center">
          {selectedDays > 0 && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
              {selectedDays} {selectedDays === 1 ? 'dia' : 'dias'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const today = new Date();
  const isTodayWeekend = isWeekend(today);

  // Calculate selected days for range mode
  const selectedDays = React.useMemo(() => {
    if (props.mode === 'range' && props.selected) {
      const range = props.selected as DateRange;
      if (range.from && range.to) {
        return differenceInDays(range.to, range.from) + 1;
      } else if (range.from) {
        return 1;
      }
    }
    return 0;
  }, [props.mode, props.selected]);

  return (
    <SelectedDaysContext.Provider value={selectedDays}>
      <div className={cn(
        "rounded-2xl bg-gray-500/20 dark:bg-gray-600/20 backdrop-blur-sm",
        "border border-white/20 dark:border-white/10 shadow-2xl p-4 pointer-events-auto",
        className
      )}>
        <DayPicker
          locale={ptBR}
          showOutsideDays={showOutsideDays}
          weekStartsOn={1}
          modifiers={{
            weekend: (date) => isWeekend(date),
          }}
          modifiersClassNames={{
            weekend: "text-red-500",
          }}
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4 relative",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-semibold text-foreground",
            nav: "space-x-1 flex items-center",
            nav_button: cn(
              "h-8 w-8 bg-transparent p-0 text-muted-foreground hover:text-foreground hover:bg-white/20 dark:hover:bg-white/10 rounded-full transition-colors",
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell: "text-gray-500 rounded-md w-10 font-medium text-[0.75rem] uppercase [&:nth-child(6)]:text-red-500 [&:nth-child(7)]:text-red-500",
            row: "flex w-full mt-2",
            cell: "h-10 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
            day: cn(
              "h-10 w-10 p-0 font-normal rounded-full transition-all hover:bg-white/20 dark:hover:bg-white/10 text-gray-500",
            ),
            day_range_start: "day-range-start bg-blue-700 !text-white rounded-full hover:bg-blue-700",
            day_range_end: "day-range-end bg-blue-700 !text-white rounded-full hover:bg-blue-700",
            day_selected:
              "bg-blue-700 !text-white hover:bg-blue-700 hover:!text-white focus:bg-blue-700 focus:!text-white rounded-full",
            day_today: isTodayWeekend 
              ? "bg-red-200 dark:bg-red-900/50 !text-red-600 dark:!text-red-400 font-semibold rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 hover:!text-red-600" 
              : "bg-blue-500 !text-white font-semibold rounded-full hover:bg-blue-500 hover:!text-white",
            day_outside:
              "day-outside text-muted-foreground/50 opacity-50",
            day_disabled: "text-muted-foreground/30",
            day_range_middle: "aria-selected:bg-gray-200 dark:aria-selected:bg-gray-700 aria-selected:text-gray-700 dark:aria-selected:text-gray-300 rounded-none",
            day_hidden: "invisible",
            ...classNames,
          }}
          components={{
            Caption: CustomCaption,
            IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
            IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
          }}
          {...props}
        />
      </div>
    </SelectedDaysContext.Provider>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
