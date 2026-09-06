import FullCalendar from '@fullcalendar/react';
import type { DatesSetInfo, EventInput } from '@fullcalendar/react';

import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import listPlugin from '@fullcalendar/react/list';
import { Temporal } from 'temporal-polyfill';

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
    events,
    onRangeChange
}: SchedulerCalendarProps) {

    const handleDatesSet = (
        info: DatesSetInfo
    ) => {

        const startDate =
            info.startStr.slice(0, 10);

        const endDate =
            Temporal.PlainDate
                .from(info.endStr.slice(0, 10))
                .subtract({ days: 1 })
                .toString();

        onRangeChange({
            startDate,
            endDate
        });
    };

    return (
        <div className="scheduler-calendar">
            <FullCalendar
                plugins={[
                    dayGridPlugin,
                    timeGridPlugin,
                    listPlugin
                ]}
                initialView="dayGridMonth"

                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,listWeek'
                }}

                locale="ko"

                events={events}
                datesSet={handleDatesSet}
            />
        </div>
    );
}

export default SchedulerCalendar;