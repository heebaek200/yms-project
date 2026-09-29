import FullCalendar from '@fullcalendar/react';
import type { DatesSetInfo, EventClickInfo, EventInput } from '@fullcalendar/react';

import themePlugin from '@fullcalendar/react/themes/classic';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import listPlugin from '@fullcalendar/react/list';
import koLocale from '@fullcalendar/react/locales/ko';
import { Temporal } from 'temporal-polyfill';

/* FullCalendar v7 기본 스타일 */
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';

import './SchedulerCalendar.css';

// 스케쥴러 날짜 범위 타입
export type SchedulerDateRange = {
    startDate: string;
    endDate: string;
};

type SchedulerCalendarProps = {
    events: EventInput[];
    isLoading: boolean;

    onRangeChange: (
        range: SchedulerDateRange
    ) => void;

    onEventClick: (
        event: SchedulerEventClickData
    ) => void;
};

// 이벤트 클릭 시의 데이터 타입
export type SchedulerEventClickData = {
    taskId: number;
    projectId: number;
};

/**
 * Dashboard Schedule 데이터를 월간·주간·목록 View로 표시합니다.
 * 모든 View가 동일한 로딩 상태 레이어를 사용하며 목록 View의 빈 문구도 조회 상태와 구분하고,
 * 날짜 범위 및 일정 클릭 결과는 YMS에서 사용하는 최소 데이터만 상위로 전달합니다.
 */
function SchedulerCalendar({
    events,
    isLoading,
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
     * 프로젝트에서 필요한 taskId와 projectId만 전달합니다.
     */
    const handleEventClick = (
        info: EventClickInfo
    ) => {

        // Adapter에서 저장해 둔 원본 식별자를 꺼냅니다.
        const taskId =
            Number(info.event.extendedProps.taskId);

        const projectId =
            Number(info.event.extendedProps.projectId);

        onEventClick({
            taskId,
            projectId
        });
    };

    return (
        <div
            className="scheduler-calendar"
            aria-busy={isLoading}
        >
            <FullCalendar
                plugins={[
                    themePlugin,
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

                locale={koLocale}

                events={events}
                datesSet={handleDatesSet}
                eventClick={handleEventClick}

                /* Toolbar */
                headerToolbarClass="scheduler-calendar__toolbar"
                toolbarTitleClass="scheduler-calendar__toolbar-title"

                buttonGroupClass="scheduler-calendar__button-group"

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

                /* 목록 View는 로딩 완료 후에만 실제 빈 결과 문구를 표시합니다. */
                noEventsContent={isLoading ? '' : '일정이 없습니다.'}

                /* 일정 */
                eventClass="scheduler-calendar__event"

                rowEventClass={(info) => {
                    const classes = [
                        'scheduler-calendar__row-event'
                    ];

                    if (!info.isStart) {
                        classes.push(
                            'scheduler-calendar__row-event--continued-before'
                        );
                    }

                    if (!info.isEnd) {
                        classes.push(
                            'scheduler-calendar__row-event--continued-after'
                        );
                    }

                    return classes.join(' ');
                }}

                eventContent={(info) => {
                    const taskTypeName =
                        String(
                            info.event.extendedProps.taskTypeName ?? ''
                        );

                    return (
                        <div className="scheduler-calendar__event-content">
                            <span className="scheduler-calendar__event-task">
                                {taskTypeName}
                            </span>

                            <span className="scheduler-calendar__event-title">
                                {info.event.title}
                            </span>
                        </div>
                    );
                }}
            />

            {/* FullCalendar의 View 종류와 관계없이 같은 위치와 문구로 로딩 상태를 표시합니다. */}
            {isLoading && (
                <div
                    className="scheduler-calendar__loading"
                    role="status"
                    aria-live="polite"
                >
                    일정을 불러오는 중입니다.
                </div>
            )}
        </div>
    );
}

export default SchedulerCalendar;
