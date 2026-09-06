import FullCalendar from '@fullcalendar/react';
import type { EventInput } from '@fullcalendar/react';

import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import listPlugin from '@fullcalendar/react/list';

import './SchedulerCalendar.css';

// 스케쥴러 날짜 범위 타입
export type SchedulerDateRange = {
    startDate: string;
    endDate: string;
};

type SchedulerCalendarProps = {
    events: EventInput[];
    onRangeChange: (
        range: SchedulerDateRange
    ) => void;
};

function SchedulerCalendar({
    events
}: SchedulerCalendarProps) {

    return (
        <div className="scheduler-calendar">
            <FullCalendar
                plugins={[
                    dayGridPlugin,
                    timeGridPlugin,
                    listPlugin
                ]}
                initialView="dayGridMonth"
                events={events}
            />
        </div>
    );
}

export default SchedulerCalendar;