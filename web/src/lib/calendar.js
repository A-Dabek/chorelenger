export function getGoogleCalendarUrl(item) {
  const text = encodeURIComponent(item.title);
  const details = encodeURIComponent(item.notes || '');
  const location = encodeURIComponent(item.location || '');
  const cleanDate = (item.start_date || '').replace(/-/g, '');
  let datesParam = '';
  if (item.is_all_day || !item.start_time) {
    const startDateObj = new Date(item.start_date + 'T00:00:00');
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endYear = endDateObj.getFullYear();
    const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
    const endDay = String(endDateObj.getDate()).padStart(2, '0');
    const endClean = `${endYear}${endMonth}${endDay}`;
    datesParam = `${cleanDate}/${endClean}`;
  } else {
    const startTimeClean = item.start_time.replace(/:/g, '') + '00';
    let endTimeClean = startTimeClean;
    if (item.end_time) {
      endTimeClean = item.end_time.replace(/:/g, '') + '00';
    } else {
      const [h, m] = item.start_time.split(':').map(Number);
      const endH = String((h + 1) % 24).padStart(2, '0');
      endTimeClean = `${endH}${String(m).padStart(2, '0')}00`;
    }
    datesParam = `${cleanDate}T${startTimeClean}/${cleanDate}T${endTimeClean}`;
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${datesParam}&details=${details}&location=${location}`;
}
