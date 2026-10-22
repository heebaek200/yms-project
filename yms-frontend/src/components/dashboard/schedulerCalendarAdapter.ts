import type { EventInput } from '@fullcalendar/react';
import type { CalendarEvent } from '../../api/dashboard/schedule';
import { Temporal } from 'temporal-polyfill';

/*
 FullCalendar 의 인터페이스 id / title / start / end 등
 YMS의 인터페이스 taskId / projectId / taskTypeName / workerName / 선택적 workerAmount / taskStatus 등
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
        id: String(event.taskId),
        title: event.projectTitle,

        start: event.startDate,
        end: exclusiveEndDate,

        allDay: true,

        extendedProps: {
            // 원본 데이터
            taskId: event.taskId,
            projectId: event.projectId,
            taskTypeId: event.taskTypeId,
            taskTypeName: event.taskTypeName,
            workerName: event.workerName,
            taskStatus: event.taskStatus,

            startDate: event.startDate,
            endDate: event.endDate,

            // Schedule API가 OWNER·ADMIN에게 반환한 경우에만 재무 필드를 전달합니다.
            ...(event.workerAmount === undefined
                ? {}
                : { workerAmount: event.workerAmount })
        }
    };
}

export function toFullCalendarEvents(
    events: CalendarEvent[]
): EventInput[] {

    return events.map(toFullCalendarEvent);
}
