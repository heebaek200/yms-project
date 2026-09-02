import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import listPlugin from '@fullcalendar/react/list';

function SchedulerCalendar() {
    return (
        <FullCalendar
            plugins={[
                dayGridPlugin,
                timeGridPlugin,
                listPlugin
            ]}
            initialView="dayGridMonth"
            events={[
                {
                    title: 'FullCalendar 설치 테스트',
                    start: '2026-09-02'
                }
            ]}
        />
    );
}

export default SchedulerCalendar;