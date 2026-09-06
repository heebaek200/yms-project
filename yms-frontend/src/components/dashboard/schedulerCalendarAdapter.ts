import type { EventInput } from '@fullcalendar/react';
import type { CalendarEvent } from '../../api/dashboard/schedule';
import { Temporal } from 'temporal-polyfill';

/*
 FullCalendar 의 인터페이스 id / title / start / end 등
 YMS의 인터페이스 assignmentId / projectId / taskType / workerName / cost / assignmentStatus 등
 데이터 중간 계층 변환 기능
 */

/*
일정 시작일 / 종료일 처리 규칙. 작업 마감일이 하루 부족하게 표시되지 않도록 변환 처리

예시)
    API
    startDate = 2026-08-01   ← 포함
    endDate   = 2026-08-07   ← 포함


    FullCalendar
    start = 2026-08-01       ← 포함
    end   = 2026-08-08       ← 제외
 */
function toExclusiveEndDate(
    endDate: string
): string {

    return Temporal.PlainDate
        .from(endDate)
        .add({ days: 1 })
        .toString();
}


export function toFullCalendarEvent(
    event: CalendarEvent
): EventInput {

    const exclusiveEndDate =
        toExclusiveEndDate(event.endDate);

    return {
        // 표시용 데이터
        id: String(event.assignmentId),
        title: event.projectTitle,

        start: event.startDate,
        end: exclusiveEndDate,

        allDay: true,

        extendedProps: {
            // 원본 데이터
            assignmentId: event.assignmentId,
            projectId: event.projectId,
            taskType: event.taskType,
            workerName: event.workerName,
            cost: event.cost,
            assignmentStatus: event.assignmentStatus,

            startDate: event.startDate,
            endDate: event.endDate
        }
    };
}

export function toFullCalendarEvents(
    events: CalendarEvent[]
): EventInput[] {

    return events.map(toFullCalendarEvent);
}