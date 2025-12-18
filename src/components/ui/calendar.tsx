import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const [monthInput, setMonthInput] = React.useState(String(displayMonth.getMonth() + 1).padStart(2, '0'));
  const [yearInput, setYearInput] = React.useState(String(displayMonth.getFullYear()));

  // Update parent when values change
  React.useEffect(() => {
    const newDate = setYear(setMonth(displayMonth, selectedMonth), selectedYear);
    onChange(newDate);
  }, [selectedMonth, selectedYear]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMonthInput(value);
    
    const num = parseInt(value, 10);
    if (num >= 1 && num <= 12) {
      setSelectedMonth(num - 1);
    }
  };

  const handleMonthBlur = () => {
    // Format to 2 digits on blur
    setMonthInput(String(selectedMonth + 1).padStart(2, '0'));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYearInput(value);
    
    const num = parseInt(value, 10);
    if (num >= 1900 && num <= 2100) {
      setSelectedYear(num);
    }
  };

  const handleYearBlur = () => {
    // Ensure valid year on blur
    if (selectedYear < 1900) setSelectedYear(1900);
    if (selectedYear > 2100) setSelectedYear(2100);
    setYearInput(String(selectedYear));
  };

  return (
    <div className="flex items-center justify-center gap-2 py-3 px-4 border-b border-gray-300/30 dark:border-white/10">
      {/* Month Input */}
      <input
        type="text"
        inputMode="numeric"
        value={monthInput}
        onChange={handleMonthChange}
        onBlur={handleMonthBlur}
        onFocus={(e) => e.target.select()}
        className="w-8 bg-transparent text-gray-600 dark:text-gray-400 font-semibold text-sm text-center focus:outline-none focus:ring-0 rounded-lg hover:bg-white/20 dark:hover:bg-white/10 py-1"
        maxLength={2}
      />
      <span className="text-gray-400 dark:text-gray-500">/</span>
      {/* Year Input */}
      <input
        type="text"
        inputMode="numeric"
        value={yearInput}
        onChange={handleYearChange}
        onBlur={handleYearBlur}
        onFocus={(e) => e.target.select()}
        className="w-12 bg-transparent text-gray-600 dark:text-gray-400 font-semibold text-sm text-center focus:outline-none focus:ring-0 rounded-lg hover:bg-white/20 dark:hover:bg-white/10 py-1"
        maxLength={4}
      />
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
    <div className="flex flex-col items-center" ref={pickerRef}>
      {/* Integrated Month/Year Picker - Above title when open */}
      {showPicker && (
        <div className="w-full -mx-4 -mt-4 mb-2">
          <MonthYearPicker displayMonth={displayMonth} onChange={handleChange} />
        </div>
      )}
      
      {/* Month/Year Title - Clickable */}
      <div className="flex items-center gap-4">
        <span 
          onClick={() => setShowPicker(!showPicker)}
          className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer capitalize"
        >
          {format(displayMonth, "MMMM yyyy", { locale: ptBR })}
        </span>
        
        {selectedDays > 0 && (
          <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
            {selectedDays} {selectedDays === 1 ? 'dia' : 'dias'}
          </span>
        )}
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
        "rounded-2xl bg-gray-500/20 dark:bg-gray-600/20 backdrop-blur-sm p-4 pointer-events-auto",
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
            head_cell: "text-blue-700 rounded-md w-10 font-medium text-[0.75rem] uppercase [&:nth-child(6)]:text-red-500 [&:nth-child(7)]:text-red-500",
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
