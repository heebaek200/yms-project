import FullCalendar from '@fullcalendar/react';
import type { DatesSetInfo, EventClickInfo, EventInput } from '@fullcalendar/react';

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

    onEventClick: (
        event: SchedulerEventClickData
    ) => void;
};

// 이벤트 클릭 시의 데이터 타입
export type SchedulerEventClickData = {
    assignmentId: number;
    projectId: number;
};

function SchedulerCalendar({
    events,
    onRangeChange,
    onEventClick
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

    /**
     * FullCalendar에서 클릭된 일정의 YMS 식별자를 추출합니다.
     * FullCalendar 객체 자체를 상위 컴포넌트에 노출하지 않고,
     * 프로젝트에서 필요한 assignmentId와 projectId만 전달합니다.
     */
    const handleEventClick = (
        info: EventClickInfo
    ) => {

        // Adapter에서 저장해 둔 원본 식별자를 꺼냅니다.
        const assignmentId =
            Number(info.event.extendedProps.assignmentId);

        const projectId =
            Number(info.event.extendedProps.projectId);

        onEventClick({
            assignmentId,
            projectId
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
                eventClick={handleEventClick}

                /* Toolbar */
                headerToolbarClass="scheduler-calendar__toolbar"
                toolbarTitleClass="scheduler-calendar__toolbar-title"

                buttonClass={(info) => {
                    return info.isSelected
                        ? 'scheduler-calendar__button scheduler-calendar__button--active'
                        : 'scheduler-calendar__button';
                }}

                /* 요일 Header */
                dayHeaderClass="scheduler-calendar__day-header"
                dayHeaderInnerClass="scheduler-calendar__day-header-inner"

                /* 날짜 Cell */
                dayCellClass={(info) => {
                    const classes = [
                        'scheduler-calendar__day-cell'
                    ];

                    if (info.isToday) {
                        classes.push(
                            'scheduler-calendar__day-cell--today'
                        );
                    }

                    if (info.isOther) {
                        classes.push(
                            'scheduler-calendar__day-cell--other'
                        );
                    }

                    return classes.join(' ');
                }}

                dayCellTopInnerClass="scheduler-calendar__day-number"

                /* 주간 시간 영역 */
                slotHeaderClass="scheduler-calendar__slot-header"
                slotHeaderInnerClass="scheduler-calendar__slot-header-inner"
                slotLaneClass="scheduler-calendar__slot-lane"

                dayLaneClass={(info) => {
                    return info.isToday
                        ? 'scheduler-calendar__day-lane scheduler-calendar__day-lane--today'
                        : 'scheduler-calendar__day-lane';
                }}

                /* 주간 All-day 영역 */
                allDayHeaderClass="scheduler-calendar__all-day-header"
                allDayHeaderInnerClass="scheduler-calendar__all-day-header-inner"

                /* 목록 View */
                views={{
                    list: {
                        className: 'scheduler-calendar__list-view'
                    }
                }}

                listDayHeaderClass="scheduler-calendar__list-day-header"
                listDayHeaderInnerClass="scheduler-calendar__list-day-header-inner"

                listItemEventClass="scheduler-calendar__list-event"

                /* 일정 */
                eventClass="scheduler-calendar__event"

                eventContent={(info) => {
                    const taskTypeLabel =
                        String(
                            info.event.extendedProps.taskTypeLabel ?? ''
                        );

                    return (
                        <div className="scheduler-calendar__event-content">
                            <span className="scheduler-calendar__event-task">
                                {taskTypeLabel}
                            </span>

                            <span className="scheduler-calendar__event-title">
                                {info.event.title}
                            </span>
                        </div>
                    );
                }}
            />
        </div>
    );
}

export default SchedulerCalendar;