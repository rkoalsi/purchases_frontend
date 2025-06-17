const dateUtils = {
  format: (date: any, formatStr: any) => {
    if (!date) return '';

    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    const monthNum = (date.getMonth() + 1).toString().padStart(2, '0');

    if (formatStr === 'dd MMM yyyy') {
      return `${day} ${month} ${year}`;
    }
    if (formatStr === 'yyyy-MM-dd') {
      return `${year}-${monthNum}-${day}`;
    }
    return date.toLocaleDateString();
  },

  isAfter: (date1: any, date2: any) => date1 > date2,
  isBefore: (date1: any, date2: any) => date1 < date2,
  isSameDay: (date1: any, date2: any) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  },

  addMonths: (date: any, months: any) => {
    const newDate = new Date(date);
    newDate.setMonth(date.getMonth() + months);
    return newDate;
  },

  startOfMonth: (date: any) => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  },

  endOfMonth: (date: any) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  },

  startOfWeek: (date: any, startOfWeek = 0) => {
    // 0 = Sunday
    const day = date.getDay();
    const diff = date.getDate() - day + startOfWeek;
    return new Date(date.setDate(diff));
  },

  endOfWeek: (date: any, startOfWeek = 0) => {
    const startWeek = dateUtils.startOfWeek(new Date(date), startOfWeek);
    return new Date(startWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
  },

  eachDayOfInterval: (start: any, end: any) => {
    const days = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  },

  isSameMonth: (date1: any, date2: any) => {
    return (
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  },

  getMonthName: (date: any) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  },
};

export default dateUtils;
