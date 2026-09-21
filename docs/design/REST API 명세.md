# REST API 명세

> YMS 백엔드에서 제공할 REST API와 WebSocket/STOMP 메시지 규격을 정의합니다.  
> 본 문서는 현재 요구사항, 사용자 시나리오, 화면 설계와 데이터베이스 설계를 기준으로 기존 블로그 API 명세를 전면 재작성한 기준 문서입니다.

## 1. API 설계 원칙

YMS는 Workspace를 업무 데이터의 최상위 경계로 사용합니다.

따라서 Workspace에 속하는 리소스는 가능한 한 URL에서 Workspace 범위를 명시합니다.

~~~text
/api/workspaces/{workspaceId}/...
~~~

모든 Workspace 하위 API는 다음 순서로 권한을 검증합니다.

~~~text
인증 사용자 확인
→ Workspace Member 확인
→ Workspace Role 확인
→ 대상 Resource의 Workspace 일치 확인
→ Project 권한 등 세부 권한 확인
~~~

주요 원칙:

- REST API는 화면의 모양보다 도메인 리소스를 기준으로 설계합니다.
- PROJECT / CAMPAIGN / CHANNEL 등 Workspace 하위 리소스는 다른 Workspace와 섞이지 않도록 서버에서 다시 검증합니다.
- CREATOR / EDITOR / THUMBNAILER 전문 역할과 OWNER / ADMIN / MEMBER Workspace 권한을 분리합니다.
- Project의 EDIT / VIEW 권한은 Workspace 전체 재무 정보 접근 권한을 의미하지 않습니다.
- 금액과 조회수 1회당 수익 단가처럼 BigDecimal 성격의 값은 JSON에서 String으로 전달합니다.
- 실제 Revenue와 조회수 기반 예상 수익을 구분합니다.
- 예상 플랫폼 수익은 응답 시 계산할 수 있지만 DB에는 저장하지 않습니다.
- 목록 API는 데이터 규모 증가를 고려하여 page / size 또는 cursor 기반 페이징을 사용합니다.
- 일반 CRUD로 표현하기 어려운 명확한 상태 전이는 confirm, mark-paid, void, transfer-owner 등의 Action Endpoint를 허용합니다.
- 화면에서 입력을 제한하더라도 백엔드에서 동일한 유효성 검증과 권한 검증을 다시 수행합니다.

---

# 2. 공통 규칙

## 2.1. Base URL

~~~text
/api
~~~

## 2.2. 인증

인증이 필요한 REST 요청은 다음 헤더를 사용합니다.

~~~http
Authorization: Bearer {accessToken}
~~~

Access Token이 없거나 만료된 경우:

- HTTP 401 Unauthorized
- errorCode: UNAUTHORIZED_SESSION

## 2.3. 날짜와 시간

| 종류 | 형식 | 예 |
| --- | --- | --- |
| 날짜 | YYYY-MM-DD | 2026-09-21 |
| 연월 | YYYY-MM | 2026-09 |
| 날짜/시간 | ISO-8601 | 2026-09-21T14:30:00+09:00 |

## 2.4. 금액과 소수 단가

DB의 DECIMAL / Java의 BigDecimal 값을 JavaScript Number로 자동 변환하지 않도록 API에서는 String으로 전달합니다.

예:

~~~json
{
  "workerAmount": "400000.00",
  "longFormRate": "3.125000",
  "actualRevenue": "11000000.00"
}
~~~

조회수, Task 수 등 정수형 값은 JSON Number를 사용합니다.

## 2.5. 성공 응답 Envelope

단건 또는 객체 응답:

~~~json
{
  "success": true,
  "message": "처리가 완료되었습니다.",
  "data": {}
}
~~~

조회 API에서 별도 사용자 메시지가 필요하지 않은 경우 message는 생략할 수 있습니다.

## 2.6. 오류 응답 Envelope

~~~json
{
  "success": false,
  "errorCode": "INVALID_INPUT_VALUE",
  "message": "입력값 검증에 실패했습니다.",
  "errors": [
    {
      "field": "title",
      "value": " ",
      "reason": "프로젝트 제목은 공백일 수 없습니다."
    }
  ]
}
~~~

errors가 없는 경우 null을 반환합니다.

## 2.7. HTTP 상태 코드

| 상태 코드 | 사용 기준 |
| --- | --- |
| 200 OK | 조회 및 수정 성공 |
| 201 Created | 새 리소스 생성 성공 |
| 204 No Content | 응답 본문이 필요 없는 삭제 / 상태 해제 성공 |
| 400 Bad Request | 필드 형식, 값 범위, 날짜 관계 등 입력 검증 실패 |
| 401 Unauthorized | 인증 누락 또는 만료 |
| 403 Forbidden | 인증됐으나 해당 리소스 또는 기능 권한 없음 |
| 404 Not Found | 존재하지 않거나 접근 범위에서 찾을 수 없는 리소스 |
| 409 Conflict | 중복, 현재 상태 충돌, 잘못된 상태 전이 |
| 502 Bad Gateway | 외부 API 응답 오류 |
| 503 Service Unavailable | 외부 API 또는 서비스 일시 장애 |

---

# 3. 인증 및 내 프로필 API

## 3.1. 회원가입

POST /api/auth/signup

요청:

| 필드 | 타입 | 필수 | 제약 |
| --- | --- | --- | --- |
| email | String | Y | 이메일 형식, 최대 255자 |
| password | String | Y | 6~100자 |
| name | String | Y | 2~50자, trim 후 공백 불가 |

전문 역할과 CREATOR 기본 단가는 회원가입 단계에서 받지 않고 SCR-02 프로필 설정에서 처리합니다.

요청 예:

~~~json
{
  "email": "user@example.com",
  "password": "pwd123",
  "name": "김편집"
}
~~~

응답: 201 Created

~~~json
{
  "success": true,
  "message": "회원가입이 완료되었습니다.",
  "data": {
    "userId": 1,
    "email": "user@example.com",
    "name": "김편집",
    "accessToken": "eyJ...",
    "tokenType": "Bearer",
    "profileSetupRequired": true
  }
}
~~~

주요 오류:

- DUPLICATE_EMAIL → 409
- INVALID_INPUT_VALUE → 400

## 3.2. 로그인

POST /api/auth/login

요청:

~~~json
{
  "email": "user@example.com",
  "password": "pwd123"
}
~~~

응답: 200 OK

~~~json
{
  "success": true,
  "data": {
    "userId": 1,
    "email": "user@example.com",
    "name": "김편집",
    "roles": ["EDITOR"],
    "accessToken": "eyJ...",
    "tokenType": "Bearer",
    "profileSetupRequired": false
  }
}
~~~

로그인 실패 사유는 계정 존재 여부가 드러나지 않도록 통합합니다.

~~~json
{
  "success": false,
  "errorCode": "INVALID_CREDENTIALS",
  "message": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "errors": null
}
~~~

## 3.3. 내 프로필 조회

GET /api/users/me/profile

응답 항목:

- userId
- email
- name
- roles
- longFormRate
- shortFormRate

CREATOR 설정이 없는 경우 단가 필드는 null일 수 있습니다.

## 3.4. 내 프로필 수정

PATCH /api/users/me/profile

요청:

| 필드 | 타입 | 필수 | 제약 |
| --- | --- | --- | --- |
| name | String | N | 2~50자 |
| roles | Array(String) | N | CREATOR / EDITOR / THUMBNAILER, 최소 1개 |
| longFormRate | String | N | 0 이상, 소수 6자리 이내 |
| shortFormRate | String | N | 0 이상, 소수 6자리 이내 |
| rateScope | String | N | FUTURE_ONLY / INCLUDE_UNFINALIZED |

CREATOR 역할이 포함된 상태에서 단가를 신규 설정하거나 변경할 수 있습니다.

rateScope:

- FUTURE_ONLY: 이후 생성되는 Project의 기본값으로만 사용
- INCLUDE_UNFINALIZED: 기존 미확정 Project에도 사용자가 명시적으로 새 값을 적용

완료 / 업로드 확정된 Project의 단가 스냅샷은 소급 변경하지 않습니다.

---

# 4. Workspace 및 Invitation API

## 4.1. Workspace 목록 조회

GET /api/workspaces

현재 사용자가 ACTIVE MEMBER인 Workspace를 조회합니다.

응답 항목:

- workspaceId
- name
- myRole
- activeProjectCount

## 4.2. Workspace 생성

POST /api/workspaces

요청:

~~~json
{
  "name": "YMS Media Team",
  "description": "영상 제작 운영팀"
}
~~~

생성한 사용자는 자동으로 OWNER가 됩니다.

응답: 201 Created

## 4.3. Workspace 상세 조회

GET /api/workspaces/{workspaceId}

현재 사용자의 Workspace 권한과 기본 정보를 함께 반환합니다.

## 4.4. Workspace 수정

PATCH /api/workspaces/{workspaceId}

권한:

- OWNER
- ADMIN

수정 가능:

- name
- description

## 4.5. Workspace 멤버 목록

GET /api/workspaces/{workspaceId}/members

Query:

- status: ACTIVE / LEFT / REMOVED / ALL
- keyword
- page
- size

## 4.6. Workspace 멤버 권한 변경

PATCH /api/workspaces/{workspaceId}/members/{workspaceMemberId}

요청:

~~~json
{
  "workspaceRole": "ADMIN"
}
~~~

주요 오류:

- LAST_OWNER_REQUIRED → 409
- FORBIDDEN_WORKSPACE_ADMIN → 403

마지막 ACTIVE OWNER를 MEMBER 또는 ADMIN으로 내릴 수 없습니다.

## 4.7. Workspace 멤버 제외

DELETE /api/workspaces/{workspaceId}/members/{workspaceMemberId}

실제 row 물리 삭제가 아니라 status를 REMOVED로 변경합니다.

마지막 OWNER는 제외할 수 없습니다.

## 4.8. 초대 목록

GET /api/workspaces/{workspaceId}/invitations

권한:

- OWNER
- ADMIN

Query:

- status
- keyword
- page
- size

## 4.9. Workspace 초대 생성

POST /api/workspaces/{workspaceId}/invitations

요청:

~~~json
{
  "email": "editor@example.com"
}
~~~

가입 여부와 관계없이 초대할 수 있습니다.

주요 오류:

- ALREADY_WORKSPACE_MEMBER → 409
- PENDING_INVITATION_EXISTS → 409

## 4.10. Workspace 초대 수락 / 거절

POST /api/workspace-invitations/{invitationId}/accept

POST /api/workspace-invitations/{invitationId}/reject

PENDING 상태의 유효한 초대만 처리할 수 있습니다.

## 4.11. Workspace 초대 취소

DELETE /api/workspace-invitations/{invitationId}

권한:

- 해당 Workspace OWNER / ADMIN

PENDING 초대를 CANCELLED로 변경합니다.

---

# 5. Channel 및 Task Type API

## 5.1. Channel 목록

GET /api/workspaces/{workspaceId}/channels

Query:

- activeOnly: 기본 true
- keyword

## 5.2. Channel 생성

POST /api/workspaces/{workspaceId}/channels

요청:

~~~json
{
  "name": "테크 리뷰",
  "youtubeChannelId": "UCxxxxxxxx",
  "youtubeChannelUrl": "https://youtube.com/@example",
  "description": "메인 테크 채널"
}
~~~

권한:

- OWNER
- ADMIN

응답: 201 Created

## 5.3. Channel 수정 / 비활성화

PATCH /api/workspaces/{workspaceId}/channels/{channelId}

수정 가능:

- name
- youtubeChannelId
- youtubeChannelUrl
- description
- active

Project가 연결된 Channel은 물리 삭제하지 않습니다.

## 5.4. Task Type 목록

GET /api/workspaces/{workspaceId}/task-types

Query:

- activeOnly: 기본 true

## 5.5. Task Type 생성

POST /api/workspaces/{workspaceId}/task-types

요청:

~~~json
{
  "name": "자막"
}
~~~

Workspace 내 동일 이름은 중복 생성할 수 없습니다.

## 5.6. Task Type 수정 / 비활성화

PATCH /api/workspaces/{workspaceId}/task-types/{taskTypeId}

이미 사용된 Task Type은 삭제하지 않고 active=false로 전환합니다.

---

# 6. Dashboard 및 Notification API

## 6.1. Dashboard 요약 카드 조회

GET /api/workspaces/{workspaceId}/dashboard/summary

현재 사용자의 Workspace 내 업무 기준으로 집계합니다.

응답:

~~~json
{
  "success": true,
  "data": {
    "progressProjectCount": 8,
    "myDueTaskCount": 3,
    "reviewTaskCount": 2,
    "dueSoonTaskCount": 1
  }
}
~~~

일반 MEMBER는 자신이 접근 가능한 Project와 Task 범위에서 집계합니다.

## 6.2. 스케줄러 조회

GET /api/workspaces/{workspaceId}/dashboard/schedule

Query:

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| startDate | Y | YYYY-MM-DD |
| endDate | Y | YYYY-MM-DD |
| status | N | ALL / PLANNING / EDITING / REVIEW / UPLOADED / CANCELLED |
| role | N | ALL / MY_TASK / CREATOR / EDITOR / THUMBNAILER |
| channelId | N | Channel 필터 |
| keyword | N | Project / Task 검색, 최대 50자 |

보관된 Project와 CANCELLED Project는 기본 조회에서 제외하고 명시적인 조건에서만 포함합니다.

응답 예:

~~~json
{
  "success": true,
  "data": {
    "calendarEvents": [
      {
        "taskId": 101,
        "projectId": 12,
        "projectTitle": "카메라 리뷰",
        "taskTypeId": 3,
        "taskTypeName": "종합 편집",
        "workerName": "김편집",
        "startDate": "2026-09-18",
        "endDate": "2026-09-21",
        "workerAmount": "300000.00",
        "taskStatus": "REVIEW"
      }
    ],
    "todayDeadlines": []
  }
}
~~~

## 6.3. 알림 조회

GET /api/notifications

Query:

- workspaceId: 선택
- unreadOnly: 기본 true
- limit: 기본 20, 최대 100

응답:

~~~json
{
  "success": true,
  "data": {
    "unreadCount": 2,
    "notifications": [
      {
        "notificationId": 501,
        "notificationType": "TASK_UPDATE",
        "workspaceId": 1,
        "projectId": 12,
        "projectTitle": "카메라 리뷰",
        "senderName": "김편집",
        "messageSummary": "종합 편집 작업이 검수 요청 상태로 변경되었습니다.",
        "timestamp": "2026-09-21T08:31:00+09:00",
        "read": false
      }
    ]
  }
}
~~~

알림 유형 예:

- TASK_UPDATE
- NEW_CHAT
- WORKSPACE_INVITATION
- SETTLEMENT_UPDATE

## 6.4. 알림 읽음 처리

PATCH /api/notifications/{notificationId}/read

PATCH /api/notifications/read-all

read-all은 선택적으로 workspaceId를 Query Parameter로 받을 수 있습니다.

## 6.5. 글로벌 실시간 알림

WebSocket / STOMP

구독 주소:

~~~text
/user/queue/notifications
~~~

CONNECT 단계에서 Access Token 인증이 필요합니다.

이벤트 예:

~~~json
{
  "success": true,
  "notificationId": 503,
  "notificationType": "NEW_CHAT",
  "workspaceId": 1,
  "projectId": 12,
  "projectTitle": "카메라 리뷰",
  "senderName": "김편집",
  "messageSummary": "초안 업로드했습니다.",
  "timestamp": "2026-09-21T08:45:10+09:00"
}
~~~

---

# 7. Campaign API

## 7.1. Campaign 목록

GET /api/workspaces/{workspaceId}/campaigns

Query:

- status
- startDate
- endDate
- keyword
- page
- size

권한:

- OWNER
- ADMIN

## 7.2. Campaign 생성

POST /api/workspaces/{workspaceId}/campaigns

요청:

~~~json
{
  "name": "신제품 카메라 협찬",
  "description": "롱폼 1편 + Shorts 2편",
  "startDate": "2026-09-01",
  "endDate": "2026-09-30",
  "status": "PLANNING"
}
~~~

응답: 201 Created

## 7.3. Campaign 상세

GET /api/workspaces/{workspaceId}/campaigns/{campaignId}

반환 정보:

- 기본 정보
- 연결 Project 요약
- 직접 ACTIVE Expense 합계
- 직접 ACTIVE Revenue 합계

## 7.4. Campaign 수정

PATCH /api/workspaces/{workspaceId}/campaigns/{campaignId}

수정 가능:

- name
- description
- startDate
- endDate
- status

상태:

- PLANNING
- ACTIVE
- COMPLETED
- CANCELLED

초기 릴리스에서는 Campaign 물리 삭제 API를 제공하지 않습니다.

---

# 8. Project 및 Project Member API

## 8.1. Project 목록

GET /api/workspaces/{workspaceId}/projects

Query:

| 필드 | 설명 |
| --- | --- |
| status | Project 상태 |
| channelId | Channel 필터 |
| campaignId | Campaign 필터 |
| participatingOnly | 내가 참여한 Project만 |
| archived | 보관 여부 |
| keyword | 제목 검색 |
| page / size | 페이징 |

일반 MEMBER는 자신에게 접근 권한이 있는 Project만 조회합니다.

## 8.2. Project 생성

POST /api/workspaces/{workspaceId}/projects

요청:

~~~json
{
  "title": "카메라 리뷰",
  "content": "제품 소개와 실제 촬영 테스트",
  "channelId": 3,
  "campaignId": 7,
  "videoType": "LONG",
  "dueDate": "2026-09-22",
  "plannedUploadDate": "2026-09-23"
}
~~~

campaignId는 null 허용입니다.

생성 시:

- 생성자를 owner_member_id로 설정
- 생성자를 Project Member EDIT로 자동 등록
- status는 PLANNING
- CREATOR 기본 단가를 videoType에 맞게 applied_revenue_per_view 초기값으로 스냅샷

주요 오류:

- CHANNEL_NOT_IN_WORKSPACE → 400
- CAMPAIGN_NOT_IN_WORKSPACE → 400
- CREATOR_RATE_NOT_CONFIGURED → 필요 시 409

## 8.3. Project 상세

GET /api/projects/{projectId}

응답 핵심 구조:

~~~json
{
  "success": true,
  "data": {
    "myPermission": "EDIT",
    "projectInfo": {
      "projectId": 12,
      "workspaceId": 1,
      "title": "카메라 리뷰",
      "channelId": 3,
      "channelName": "테크 리뷰",
      "campaignId": 7,
      "campaignName": "신제품 카메라 협찬",
      "videoType": "LONG",
      "projectStatus": "REVIEW",
      "dueDate": "2026-09-22",
      "plannedUploadDate": "2026-09-23",
      "uploadedAt": null,
      "archived": false
    },
    "projectMembers": [],
    "tasks": [],
    "youtube": null
  }
}
~~~

프로젝트 비참여자는 403을 반환합니다. Workspace OWNER / ADMIN의 관리 접근 정책은 요구사항에 맞게 허용할 수 있습니다.

## 8.4. Project 수정

PATCH /api/projects/{projectId}

수정 가능:

- title
- content
- channelId
- campaignId
- videoType
- dueDate
- plannedUploadDate
- status

권한:

- Owner
- EDIT
- 필요한 Workspace 관리자

VIEW는 수정할 수 없습니다.

## 8.5. Project 보관 / 보관 해제

POST /api/projects/{projectId}/archive

DELETE /api/projects/{projectId}/archive

보관은 Project 상태와 별개입니다.

## 8.6. Project 논리 삭제

DELETE /api/projects/{projectId}

하위 업무 이력은 유지하고 deleted_at / deleted_by_member_id를 기록합니다.

## 8.7. Project Member 추가

POST /api/projects/{projectId}/members

요청:

~~~json
{
  "workspaceMemberId": 25,
  "permissionLevel": "EDIT"
}
~~~

Workspace에 속하지 않은 사용자를 직접 Project Member로 추가할 수 없습니다.

## 8.8. Project Member 권한 수정

PATCH /api/projects/{projectId}/members/{projectMemberId}

요청:

~~~json
{
  "permissionLevel": "VIEW"
}
~~~

현재 Owner의 Project Member를 VIEW로 내릴 수 없습니다.

## 8.9. Project Member 제거

DELETE /api/projects/{projectId}/members/{projectMemberId}

현재 Owner는 제거할 수 없습니다.

## 8.10. Project Owner 이전

POST /api/projects/{projectId}/transfer-owner

요청:

~~~json
{
  "newOwnerProjectMemberId": 48
}
~~~

새 Owner는 ACTIVE Project Member이며 EDIT 권한이어야 합니다.

응답 성공 후 기존 Owner는 일반 EDIT Member로 남습니다.

---

# 9. Task API

## 9.1. Task 생성

POST /api/projects/{projectId}/tasks

요청:

| 필드 | 타입 | 필수 | 제약 |
| --- | --- | --- | --- |
| taskTypeId | Long | Y | 같은 Workspace의 활성 Task Type |
| assigneeProjectMemberId | Long | Y | ACTIVE Project Member |
| startDate | String | N | YYYY-MM-DD |
| endDate | String | N | YYYY-MM-DD |
| workerAmount | String | Y | 0 이상 |

예:

~~~json
{
  "taskTypeId": 3,
  "assigneeProjectMemberId": 45,
  "startDate": "2026-09-18",
  "endDate": "2026-09-21",
  "workerAmount": "300000.00"
}
~~~

생성 상태는 WAITING입니다.

전문 역할과 Task Type이 일반적인 조합과 다르면 프론트에서 경고할 수 있지만 서버가 강제로 배정을 차단하지는 않습니다.

## 9.2. Task 수정

PATCH /api/projects/{projectId}/tasks/{taskId}

수정 가능:

- taskTypeId
- assigneeProjectMemberId
- startDate
- endDate
- workerAmount

검증:

- endDate < startDate → 400
- Project dueDate 이후 → 저장 허용, 응답 warning 제공 가능
- CONFIRMED Settlement Item에 이미 포함된 Task의 workerAmount 변경은 과거 Settlement 스냅샷에 영향을 주지 않음

## 9.3. Task 상태 변경

PATCH /api/projects/{projectId}/tasks/{taskId}/status

요청:

~~~json
{
  "status": "REVIEW"
}
~~~

상태:

- WAITING
- PROGRESS
- REVIEW
- COMPLETED

검수 반려는 REVIEW → PROGRESS 상태 전이로 처리합니다.

COMPLETED 전환 시 completed_at을 기록합니다.

잘못된 상태 전이:

- INVALID_TASK_STATUS_TRANSITION → 409

---

# 10. Chat 및 WebSocket API

## 10.1. 참여 Project 채팅방 목록

GET /api/workspaces/{workspaceId}/chat-rooms

Query:

- keyword
- page
- size

응답:

- projectId
- projectTitle
- lastMessage
- lastSenderName
- lastMessageAt
- unreadCount

## 10.2. 과거 메시지 조회

GET /api/projects/{projectId}/messages

Query:

- beforeMessageId: 선택
- size: 기본 50, 최대 100

새 메시지가 계속 추가되는 채팅 특성을 고려하여 page 번호보다 메시지 ID cursor 방식으로 조회합니다.

응답:

~~~json
{
  "success": true,
  "data": {
    "messages": [
      {
        "chatMessageId": 5001,
        "senderProjectMemberId": 45,
        "senderUserId": 2,
        "senderName": "김편집",
        "message": "가편집 완료했습니다.",
        "sentAt": "2026-09-21T10:15:00+09:00"
      }
    ],
    "nextBeforeMessageId": 4950,
    "hasMore": true
  }
}
~~~

## 10.3. 채팅 읽음 위치 갱신

PATCH /api/projects/{projectId}/messages/read

요청:

~~~json
{
  "lastReadMessageId": 5001
}
~~~

## 10.4. 실시간 메시지 전송

WebSocket / STOMP

발행 주소:

~~~text
/app/projects/{projectId}/messages
~~~

요청:

~~~json
{
  "message": "가편집 완료했습니다. 확인 부탁드립니다."
}
~~~

제약:

- 최대 2,000자
- trim 후 공백 메시지 금지
- EDIT / VIEW 모두 전송 가능

## 10.5. 실시간 메시지 구독

~~~text
/topic/projects/{projectId}
~~~

구독 시 현재 사용자의 Project 참여 여부를 서버에서 검증합니다.

수신 예:

~~~json
{
  "chatMessageId": 5003,
  "projectId": 12,
  "senderProjectMemberId": 45,
  "senderUserId": 2,
  "senderName": "김편집",
  "message": "수정본 업로드했습니다.",
  "sentAt": "2026-09-21T14:30:00+09:00"
}
~~~

---

# 11. YouTube 연동 API

기존 close-sync처럼 영상 연결, Project 상태 변경, 외부 API 동기화와 예상 수익 계산을 한 요청에 묶지 않습니다.

## 11.1. YouTube 영상 연결 / 수익 단가 설정

PUT /api/projects/{projectId}/youtube

요청:

~~~json
{
  "youtubeVideoId": "dQw4w9WgXcQ",
  "revenueOption": "DEFAULT",
  "customRevenuePerView": null,
  "uploadedAt": "2026-09-23T18:00:00+09:00"
}
~~~

revenueOption:

- DEFAULT: Project 생성 시 또는 현재 프로필 기본 단가 사용
- CUSTOM: customRevenuePerView 필수
- DISABLED: appliedRevenuePerView를 0으로 적용

동일 Workspace 안에서 이미 다른 Project가 사용 중인 YouTube Video ID는 연결할 수 없습니다.

성공 시 Project status를 UPLOADED로 변경할 수 있으며, 구현 시 해당 동작을 서비스 트랜잭션으로 명시합니다.

## 11.2. YouTube 성과 동기화

POST /api/projects/{projectId}/youtube/sync

외부 API에서 최신 성과를 조회하여 video_performances를 갱신합니다.

응답:

~~~json
{
  "success": true,
  "data": {
    "projectId": 12,
    "viewCount": 50230,
    "likeCount": 2100,
    "commentCount": 320,
    "appliedRevenuePerView": "0.313000",
    "estimatedPlatformRevenue": "15721.990000",
    "lastSuccessAt": "2026-09-21T15:00:00+09:00"
  }
}
~~~

estimatedPlatformRevenue는 응답 시 계산하는 파생값이며 실제 Revenue가 아닙니다.

## 11.3. YouTube 관련 오류

| errorCode | HTTP | 의미 |
| --- | --- | --- |
| INVALID_YOUTUBE_VIDEO | 400 | URL / ID 형식 오류 |
| YOUTUBE_VIDEO_NOT_FOUND | 404 | API에서 영상을 확인할 수 없음 |
| DUPLICATE_YOUTUBE_VIDEO | 409 | 같은 Workspace의 다른 Project에 이미 연결 |
| CUSTOM_REVENUE_RATE_REQUIRED | 400 | CUSTOM인데 단가 누락 |
| YOUTUBE_API_UNAVAILABLE | 503 | 외부 API 일시 장애 |
| YOUTUBE_QUOTA_EXCEEDED | 503 | API 할당량 제한 |
| YOUTUBE_UPSTREAM_ERROR | 502 | 외부 API 비정상 응답 |

동기화 실패 시 마지막 성공 데이터를 삭제하지 않습니다.

---

# 12. Expense 및 Revenue API

접근 권한:

- OWNER
- ADMIN

## 12.1. Expense 목록

GET /api/workspaces/{workspaceId}/expenses

Query:

- startDate / endDate
- expenseType
- scopeType
- channelId
- campaignId
- projectId
- status: ACTIVE / VOIDED / ALL
- page / size

## 12.2. Expense 등록

POST /api/workspaces/{workspaceId}/expenses

요청:

~~~json
{
  "scopeType": "PROJECT",
  "channelId": null,
  "campaignId": null,
  "projectId": 12,
  "expenseType": "STUDIO",
  "amount": "300000.00",
  "occurredOn": "2026-09-15",
  "memo": "촬영 스튜디오 대관"
}
~~~

scopeType:

- WORKSPACE
- CHANNEL
- CAMPAIGN
- PROJECT

선택한 scopeType에 해당하는 FK 하나만 값이 있어야 합니다.

## 12.3. Expense 수정

PATCH /api/workspaces/{workspaceId}/expenses/{expenseId}

VOIDED Expense는 일반 수정할 수 없습니다.

## 12.4. Expense 무효 처리

POST /api/workspaces/{workspaceId}/expenses/{expenseId}/void

물리 삭제하지 않고 ACTIVE → VOIDED로 변경합니다.

## 12.5. Revenue 목록 / 등록 / 수정 / 무효화

다음 구조를 Expense와 동일하게 사용합니다.

~~~text
GET   /api/workspaces/{workspaceId}/revenues
POST  /api/workspaces/{workspaceId}/revenues
PATCH /api/workspaces/{workspaceId}/revenues/{revenueId}
POST  /api/workspaces/{workspaceId}/revenues/{revenueId}/void
~~~

등록 예:

~~~json
{
  "scopeType": "CAMPAIGN",
  "campaignId": 7,
  "channelId": null,
  "projectId": null,
  "revenueType": "SPONSORSHIP",
  "amount": "10000000.00",
  "occurredOn": "2026-09-01",
  "memo": "신제품 협찬 계약금"
}
~~~

Revenue에는 실제 금액만 저장합니다.

조회수 기반 예상 플랫폼 수익을 Revenue API로 등록하거나 자동 생성하지 않습니다.

---

# 13. Settlement API

## 13.1. 관리자 Settlement 목록

GET /api/workspaces/{workspaceId}/settlements

Query:

- periodStart
- periodEnd
- workerMemberId
- status
- page / size

권한:

- OWNER
- ADMIN

## 13.2. Settlement 생성

POST /api/workspaces/{workspaceId}/settlements

요청:

~~~json
{
  "workerMemberId": 25,
  "periodStart": "2026-09-01",
  "periodEnd": "2026-09-30"
}
~~~

DRAFT 생성 후보:

- Task status = COMPLETED
- completed_at이 기간 안에 포함
- 해당 작업자 Task
- 다른 Settlement Item에 포함되지 않음

응답에는 생성된 Settlement와 Item 목록을 반환합니다.

## 13.3. Settlement 상세

GET /api/workspaces/{workspaceId}/settlements/{settlementId}

반환:

- Header
- worker 정보
- period
- status
- totalAmount
- settlementItems
- confirmedAt / paidAt

## 13.4. DRAFT 재계산

POST /api/workspaces/{workspaceId}/settlements/{settlementId}/recalculate

DRAFT에서만 실행할 수 있습니다.

최신 Task의 workerAmount와 완료 여부를 기준으로 Item을 다시 계산합니다.

## 13.5. Settlement 확정

POST /api/workspaces/{workspaceId}/settlements/{settlementId}/confirm

DRAFT → CONFIRMED

확정 시 각 Settlement Item의 amountSnapshot을 고정합니다.

## 13.6. 지급 완료 처리

POST /api/workspaces/{workspaceId}/settlements/{settlementId}/mark-paid

CONFIRMED → PAID

실제 계좌이체를 수행하지 않고 지급 완료 여부만 기록합니다.

## 13.7. 내 정산 조회

GET /api/users/me/settlements

Query:

- workspaceId
- periodStart / periodEnd
- status
- page / size

일반 작업자는 자신의 정산만 조회할 수 있습니다.

주요 오류:

- SETTLEMENT_NOT_DRAFT → 409
- SETTLEMENT_NOT_CONFIRMED → 409
- TASK_ALREADY_SETTLED → 409
- INVALID_SETTLEMENT_PERIOD → 400

---

# 14. Analytics API

Backend는 Scatter Chart, Pie Chart처럼 특정 UI 라이브러리 형태에 종속된 DTO를 반환하지 않습니다.

Project / Campaign의 도메인 성과 데이터를 반환하고 React가 화면에 맞게 시각화합니다.

## 14.1. Project / Campaign 분석 조회

GET /api/workspaces/{workspaceId}/analytics

Query:

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| scopeType | Y | PROJECT / CAMPAIGN |
| targetId | Y | 분석 대상 ID |

접근 권한:

- OWNER
- ADMIN

Project 분석 예:

~~~json
{
  "success": true,
  "data": {
    "scopeType": "PROJECT",
    "targetId": 12,
    "financial": {
      "actualCost": "900000.00",
      "actualRevenue": "450000.00",
      "profit": "-450000.00",
      "roi": "-50.000000",
      "revenueCostRatio": "0.500000"
    },
    "contentMetrics": {
      "viewCount": 50230,
      "likeCount": 2100,
      "commentCount": 320,
      "estimatedPlatformRevenue": "15721.990000"
    }
  }
}
~~~

Campaign 분석 예:

~~~json
{
  "success": true,
  "data": {
    "scopeType": "CAMPAIGN",
    "targetId": 7,
    "financial": {
      "actualCost": "2300000.00",
      "actualRevenue": "11000000.00",
      "profit": "8700000.00",
      "roi": "378.260870",
      "revenueCostRatio": "4.782609"
    },
    "projects": [
      {
        "projectId": 12,
        "title": "롱폼 리뷰",
        "channelName": "테크 리뷰",
        "actualCost": "1500000.00",
        "actualRevenue": "450000.00",
        "viewCount": 50230
      }
    ],
    "contentMetrics": {
      "viewCount": 1420000,
      "likeCount": 42000,
      "estimatedPlatformRevenue": "620000.000000"
    }
  }
}
~~~

실제 비용이 0인 경우 roi와 revenueCostRatio는 null로 반환합니다.

Channel 또는 Workspace에 직접 귀속된 Expense / Revenue를 Campaign 또는 Project에 임의 배분하지 않습니다.

---

# 15. 공통 오류 코드

## 인증 / 권한

| errorCode | HTTP | 설명 |
| --- | --- | --- |
| INVALID_CREDENTIALS | 401 | 로그인 실패 |
| UNAUTHORIZED_SESSION | 401 | 인증 누락 / 만료 |
| FORBIDDEN_WORKSPACE_ACCESS | 403 | Workspace 접근 불가 |
| FORBIDDEN_WORKSPACE_ADMIN | 403 | Workspace 관리 권한 없음 |
| FORBIDDEN_PROJECT_ACCESS | 403 | Project 접근 불가 |
| INSUFFICIENT_PROJECT_PERMISSIONS | 403 | Project 수정 권한 없음 |
| FORBIDDEN_FINANCE_ACCESS | 403 | 재무 정보 접근 권한 없음 |
| FORBIDDEN_CHAT_ACCESS | 403 | 채팅 접근 권한 없음 |

## 입력 / 리소스

| errorCode | HTTP | 설명 |
| --- | --- | --- |
| INVALID_INPUT_VALUE | 400 | 일반 입력 검증 실패 |
| INVALID_DATE_RANGE | 400 | 날짜 범위 오류 |
| INVALID_FILTER_OPTION | 400 | 허용되지 않은 필터 |
| RESOURCE_NOT_FOUND | 404 | 일반 리소스 없음 |
| PROJECT_NOT_FOUND | 404 | Project 없음 |
| WORKSPACE_NOT_FOUND | 404 | Workspace 없음 |
| CAMPAIGN_NOT_FOUND | 404 | Campaign 없음 |
| CHANNEL_NOT_FOUND | 404 | Channel 없음 |

## 충돌 / 상태 전이

| errorCode | HTTP | 설명 |
| --- | --- | --- |
| DUPLICATE_EMAIL | 409 | 이메일 중복 |
| ALREADY_WORKSPACE_MEMBER | 409 | 이미 Workspace 멤버 |
| PENDING_INVITATION_EXISTS | 409 | 대기 초대 중복 |
| ALREADY_PROJECT_MEMBER | 409 | 이미 Project 참여자 |
| LAST_OWNER_REQUIRED | 409 | 마지막 Workspace OWNER 변경 불가 |
| PROJECT_OWNER_CANNOT_BE_REMOVED | 409 | 현재 Project Owner 제거 불가 |
| DUPLICATE_YOUTUBE_VIDEO | 409 | Workspace 내 YouTube 영상 중복 |
| INVALID_TASK_STATUS_TRANSITION | 409 | 잘못된 Task 상태 전이 |
| TASK_ALREADY_SETTLED | 409 | 이미 정산된 Task |
| INVALID_RESOURCE_STATE | 409 | 현재 상태에서 수행할 수 없는 동작 |

---

# 16. 화면별 API 매핑

## SCR-01 로그인 / 회원가입

~~~text
POST /api/auth/signup
POST /api/auth/login
~~~

## SCR-02 프로필 설정

~~~text
GET   /api/users/me/profile
PATCH /api/users/me/profile
~~~

## SCR-03 Workspace 선택 / 생성 / 초대

~~~text
GET  /api/workspaces
POST /api/workspaces
POST /api/workspace-invitations/{id}/accept
POST /api/workspace-invitations/{id}/reject
~~~

## SCR-04 Workspace 관리

~~~text
GET/PATCH/DELETE Workspace Member API
GET/POST/DELETE Invitation API
GET/POST/PATCH Channel API
GET/POST/PATCH Task Type API
~~~

## SCR-05 Dashboard / Scheduler

~~~text
GET /api/workspaces/{workspaceId}/dashboard/summary
GET /api/workspaces/{workspaceId}/dashboard/schedule
GET /api/notifications
PATCH /api/notifications/{notificationId}/read
/user/queue/notifications
~~~

## SCR-06 Campaign

~~~text
GET   /api/workspaces/{workspaceId}/campaigns
POST  /api/workspaces/{workspaceId}/campaigns
GET   /api/workspaces/{workspaceId}/campaigns/{campaignId}
PATCH /api/workspaces/{workspaceId}/campaigns/{campaignId}
~~~

## SCR-07 Project 목록 / 생성 / 보관함

~~~text
GET  /api/workspaces/{workspaceId}/projects
POST /api/workspaces/{workspaceId}/projects
POST /api/projects/{projectId}/archive
DELETE /api/projects/{projectId}/archive
~~~

## SCR-08 Project 상세 / 협업

~~~text
GET/PATCH/DELETE /api/projects/{projectId}
Project Member API
Task API
YouTube API
Chat REST / WebSocket API
~~~

## SCR-09 메신저

~~~text
GET /api/workspaces/{workspaceId}/chat-rooms
GET /api/projects/{projectId}/messages
PATCH /api/projects/{projectId}/messages/read
/app/projects/{projectId}/messages
/topic/projects/{projectId}
~~~

## SCR-10 비용 / 수익

~~~text
Expense API
Revenue API
~~~

## SCR-11 작업자 정산

~~~text
Workspace Settlement API
GET /api/users/me/settlements
~~~

## SCR-12 콘텐츠 성과 / 재무 분석

~~~text
GET /api/workspaces/{workspaceId}/analytics
~~~

---

# 17. 기존 API 설계에서의 주요 변경사항

- 회원가입에서 전문 역할과 수익 단가 설정을 분리하고 SCR-02 Profile API로 이동
- 인증 관련 profile-setup Endpoint를 users/me/profile로 재구성
- Workspace를 모든 업무 데이터의 API 경계로 추가
- Workspace Member / Invitation API 신규 추가
- Channel API 신규 추가
- 고정 Task Enum 대신 Workspace Task Type API 도입
- Campaign API 신규 추가
- Project 생성에 Channel, 선택적 Campaign, 일정 정보 추가
- Project Member 추가 대상을 이메일이 아닌 workspaceMemberId로 변경
- Project Owner 이전 API와 Owner 정합성 검증 추가
- assignment 용어를 task로 통일
- assignmentId → taskId
- taskType 문자열 Enum → taskTypeId + taskTypeName
- cost → workerAmount
- Dashboard summary를 최근 활동 목록이 아니라 요약 카드 집계 API로 정리
- 알림 조회와 WebSocket 실시간 알림을 함께 유지하고 읽음 처리 API 추가
- WebSocket 개인 알림 주소를 /user/queue/notifications로 사용
- close-sync API를 YouTube 영상 연결과 성과 동기화 API로 분리
- RPM 용어를 제거하고 조회수 1회당 수익 단가로 통일
- calculatedRevenue 저장 개념을 제거하고 estimatedPlatformRevenue를 파생 응답값으로 사용
- YouTube 입력 오류, 영상 없음, 중복 연결, 외부 API 장애를 구분
- Expense / Revenue API 신규 추가
- 재무 데이터 삭제 대신 VOID 처리 Action Endpoint 사용
- 단순 월별 isSettled 조회를 Settlement DRAFT → CONFIRMED → PAID 상태 전이 API로 재설계
- Chat 과거 메시지 조회를 page 방식에서 cursor 방식으로 변경
- Analytics 응답을 특정 차트 UI 구조가 아닌 Project / Campaign 도메인 데이터로 변경
- 400에 몰려 있던 중복 및 상태 충돌을 409 Conflict로 구분

이 문서를 이후 Spring Boot Controller, Request / Response DTO, Service 권한 검증과 React API 모듈 구현의 기준으로 사용합니다.
