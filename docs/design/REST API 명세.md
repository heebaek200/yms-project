# REST API 명세

> YMS 백엔드에서 제공할 REST API와 WebSocket/STOMP 메시지 규격을 정의합니다.  
> 본 문서는 현재 요구사항, 사용자 시나리오, 화면 설계와 데이터베이스 설계를 기준으로 기존 블로그 API 명세를 전면 재작성한 기준 문서입니다.

> **용어 기준:** 이 문서의 `Workspace`는 화면과 업무 문서에서 `제작팀`으로 표기하는 도메인의 기술 명칭입니다. API 경로, 필드명과 오류 코드는 호환성을 위해 `workspace` / `WORKSPACE`를 유지합니다.

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
- PROJECT / PROJECT_GROUP / CHANNEL 등 Workspace 하위 리소스는 다른 Workspace와 섞이지 않도록 서버에서 다시 검증합니다.
- CREATOR / PLANNER / WRITER / VIDEOGRAPHER / EDITOR / THUMBNAILER 전문 역할과 OWNER / ADMIN / MEMBER Workspace 권한을 분리합니다.
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

전문 역할은 회원가입 단계에서 받지 않고 SCR-02 프로필 설정에서 처리합니다. 예상 수익 기본 단가는 개인 프로필이 아니라 Channel 관리 API에서 설정합니다.

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

`profileSetupRequired`는 전문 역할 배열과 독립된 서버 판정값입니다. 클라이언트는 `roles.length`로 이 값을 추론하지 않고 회원가입·로그인 응답과 프로필 설정 완료 결과를 기준으로 갱신합니다.

브라우저에 저장된 인증 세션을 복원한 뒤 Workspace API에서 인증 만료가 확인되면 모든 탭의 인증 상태를 만료 처리합니다.

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

## 3.4. 내 프로필 수정

PATCH /api/users/me/profile

요청:

| 필드 | 타입 | 필수 | 제약 |
| --- | --- | --- | --- |
| name | String | N | 2~50자 |
| roles | Array(String) | N | CREATOR / PLANNER / WRITER / VIDEOGRAPHER / EDITOR / THUMBNAILER, 최소 1개 |

전문 역할은 전역 고정 Enum으로 관리하며 CREATOR를 포함한 모든 값은 담당자 검색과 업무 분류에 동일하게 사용합니다. 프로필 API는 예상 수익 단가를 조회하거나 수정하지 않습니다.

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

- `status`: ACTIVE / LEFT / REMOVED / ALL, 기본 ACTIVE
- `keyword`: 이름·이메일 검색
- `professionalRole`: ALL / CREATOR / PLANNER / WRITER / VIDEOGRAPHER / EDITOR / THUMBNAILER
- `workspaceRole`: ALL / OWNER / ADMIN / MEMBER
- `page`
- `size`

여러 검색 조건은 AND로 결합하고 `professionalRole`은 사용자의 활성 전문 역할 중 하나라도 일치하면 포함합니다.

멤버 응답 항목:

- workspaceMemberId
- userId
- name
- email
- professionalRoles
- workspaceRole
- status
- joinedAt
- leftAt
- ownedProjectCount: 논리 삭제되지 않은 소유 Project 수, 보관 Project 포함

## 4.5.1. Workspace 멤버 제외·탈퇴 영향 조회

GET /api/workspaces/{workspaceId}/members/{workspaceMemberId}/departure-impact

제작팀 멤버 제외 또는 본인 탈퇴 확인 화면에서 필요한 차단 사유와 영향을 지연 조회합니다. 대상 본인 또는 해당 멤버를 제외할 수 있는 Workspace OWNER·ADMIN만 호출할 수 있습니다.

응답 예:

~~~json
{
  "success": true,
  "data": {
    "workspaceMemberId": 104,
    "isLastActiveOwner": false,
    "ownedProjects": [
      {
        "projectId": 14,
        "title": "10월 편집 비하인드",
        "status": "EDITING",
        "archived": false,
        "transferableMemberCount": 1
      }
    ],
    "activeProjectParticipationCount": 3,
    "incompleteAssignedTaskCount": 5
  }
}
~~~

`ownedProjects`에는 논리 삭제되지 않은 Project만 포함하고 보관 Project도 반환합니다. `transferableMemberCount`는 대상 멤버 자신을 제외한 같은 Project의 ACTIVE EDIT 멤버 수입니다. 참여 종료 수와 미완료 Task 수는 확인 안내용 파생 값이며 별도 저장하지 않습니다.

#18 Task 관리 구현 전 Mock의 `incompleteAssignedTaskCount`는 대상 멤버의 ACTIVE Project Member 메타에 저장된 `incompleteTaskCount`를 합산한 샘플 값입니다. Project의 전체 `taskCount - completedTaskCount`를 #53에서 새로 배분하지 않으며 실제 Task별 담당 관계를 보장하지 않습니다. #18 구현 후에는 `project_tasks.assignee_project_member_id`가 대상 Project Member이고 `status <> 'COMPLETED'`인 행을 집계하도록 교체합니다.

화면은 `isLastActiveOwner`와 `ownedProjects`를 함께 평가하여 차단 사유가 여러 개이면 한 번에 표시합니다. 이 조회 결과는 작업 가능성을 예약하지 않으며 최종 제외·탈퇴 API가 최신 상태를 다시 검증합니다.

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
- FORBIDDEN_WORKSPACE_MEMBER_MANAGEMENT → 403
- WORKSPACE_MEMBER_NOT_FOUND → 404

OWNER만 ACTIVE 멤버의 Workspace Role을 변경할 수 있습니다. OWNER 승격을 포함해 복수 OWNER를 허용하지만 마지막 ACTIVE OWNER를 MEMBER 또는 ADMIN으로 내릴 수 없습니다.

OWNER는 다른 ACTIVE OWNER가 있을 때만 자신의 권한을 ADMIN 또는 MEMBER로 낮출 수 있습니다. 현재 사용자가 MEMBER로 변경된 이후 관리 API와 SCR-04 접근은 403으로 처리합니다.

SCR-04는 마지막 OWNER에게 불필요한 이메일 확인 절차를 요구하지 않도록 기존 4.5 멤버 목록 API를 `status=ACTIVE&workspaceRole=OWNER` 조건으로 호출해 사전 확인합니다. 별도 사전 검증 API는 추가하지 않으며, 조회와 변경 사이의 경합에 대비해 이 PATCH 요청이 `LAST_OWNER_REQUIRED`를 최종 검증합니다.

## 4.7. Workspace 멤버 제외

DELETE /api/workspaces/{workspaceId}/members/{workspaceMemberId}

실제 row 물리 삭제가 아니라 status를 REMOVED로 변경합니다.

권한 규칙:

- OWNER: 자기 자신을 제외할 수 없고 마지막 ACTIVE OWNER를 제외할 수 없으며, 그 외 ACTIVE 멤버를 제외할 수 있음
- ADMIN: 일반 MEMBER만 제외할 수 있음
- MEMBER: 제외 API 사용 불가

LEFT 또는 REMOVED 멤버에는 제외 요청을 보내지 않습니다. 자기 자신이 제작팀을 나가는 동작은 4.7.1의 전용 API를 사용합니다.

대상 멤버가 논리 삭제되지 않은 Project를 하나라도 소유하면 `409 PROJECT_OWNERSHIP_TRANSFER_REQUIRED`를 반환합니다. 보관 Project도 포함하고 논리 삭제 Project는 제외합니다. 화면의 `ownedProjectCount`는 위험 확인 전 사전 안내에 사용하지만 최종 판단은 이 요청의 서버 검증을 기준으로 합니다.

제외가 가능하면 Workspace Member를 REMOVED로 변경하면서 대상 멤버의 ACTIVE Project Member를 같은 트랜잭션에서 비활성화하고 참여 종료 시각을 기록합니다. 대상 Workspace Member와 소유 Project를 잠근 상태에서 재검증하여 소유권 이전 요청과의 경합을 차단합니다.

## 4.7.1. 현재 사용자 Workspace 탈퇴

DELETE /api/workspaces/{workspaceId}/members/me

현재 인증 사용자의 ACTIVE Workspace Member를 LEFT로 변경합니다. 화면의 제작팀 이름 재입력은 오조작을 줄이는 확인 절차이며, API는 인증 사용자와 Workspace Member의 일치 여부를 기준으로 대상을 결정합니다.

최종 처리 전에 다음 조건을 같은 트랜잭션에서 다시 검증합니다.

- 현재 사용자가 해당 Workspace의 ACTIVE 멤버인지
- 마지막 ACTIVE OWNER가 아닌지
- 논리 삭제되지 않은 소유 Project가 없는지

주요 오류:

- LAST_OWNER_REQUIRED → 409
- PROJECT_OWNERSHIP_TRANSFER_REQUIRED → 409
- WORKSPACE_MEMBER_NOT_FOUND → 404

탈퇴가 가능하면 Workspace Member를 LEFT로 변경하고 `leftAt`을 기록합니다. 대상 멤버의 ACTIVE Project Member를 같은 트랜잭션에서 비활성화하며 각 Project Member에 LEFT·`WORKSPACE_MEMBERSHIP` 이력을 추가합니다. 재초대 후 수락해도 이전 Project 소유권과 Project Member 상태를 자동 복구하지 않습니다.

응답 성공 후 클라이언트는 탈퇴 대상이 현재 선택한 Workspace이면 해당 탭의 선택을 해제하고 SCR-03에 머뭅니다. 다른 Workspace가 현재 선택되어 있으면 선택 상태를 유지합니다. 같은 Workspace를 사용하는 다른 탭에는 접근 상실을 전파합니다.

영향 응답의 Project 링크가 현재 선택하지 않은 Workspace를 가리키면 클라이언트는 자동 이동하지 않습니다. 사용자가 대상 Workspace 이름이 표시된 전환 동작을 선택한 경우에만 현재 탭의 Workspace를 변경한 뒤 Project Route로 이동합니다. 뒤로가기로 SCR-03에 복귀해도 이전 Workspace를 자동 복원하지 않으며 일반 Workspace 선택과 마찬가지로 다른 탭에는 전환을 전파하지 않습니다.

## 4.8. 내 Workspace 초대 목록

GET /api/workspace-invitations

현재 인증 사용자의 `userId` 또는 정규화된 이메일과 연결된 수신 초대를 조회합니다.

Query:

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| status | N | PENDING / ACCEPTED / REJECTED / CANCELLED / ALL, 기본 PENDING |

`status=PENDING` 조회에서는 현재 시각을 기준으로 만료되지 않은 초대만 반환합니다.
결과는 `sentAt` 내림차순으로 정렬합니다.

응답 예:

~~~json
{
  "success": true,
  "data": [
    {
      "invitationId": 41,
      "workspaceId": 7,
      "workspaceName": "Game Channel Studio",
      "inviterName": "박관리자",
      "status": "PENDING",
      "sentAt": "2026-10-01T14:30:00+09:00",
      "expiresAt": "2026-10-08T14:30:00+09:00"
    }
  ]
}
~~~

SCR-03은 `status=PENDING`으로 호출하며, 가입 전에 이메일로 발송된 초대도 로그인 사용자의 현재 이메일과 일치하면 반환합니다.

## 4.9. Workspace 발송 초대 목록

GET /api/workspaces/{workspaceId}/invitations

권한:

- OWNER
- ADMIN

Query:

- `status`: PENDING / ACCEPTED / REJECTED / CANCELLED / EXPIRED / ALL, 기본 PENDING
- `keyword`: 초대 이메일 검색
- `page`
- `size`

`PENDING`은 현재 시각 기준으로 만료되지 않은 초대만 반환합니다. `EXPIRED`는 DB 상태를 추가하지 않고 `status=PENDING AND expiresAt <= now` 조건으로 조회하는 파생 필터입니다. 결과는 `sentAt` 내림차순으로 정렬합니다.

응답 항목:

- invitationId
- email
- inviterName
- status
- sentAt
- expiresAt
- respondedAt

## 4.10. Workspace 초대 생성

POST /api/workspaces/{workspaceId}/invitations

요청:

~~~json
{
  "email": "editor@example.com"
}
~~~

가입 여부와 관계없이 초대할 수 있습니다.

초대 요청에는 Workspace Role을 포함하지 않으며 수락 시 항상 MEMBER로 참여합니다. ACTIVE 멤버는 초대할 수 없지만 LEFT 또는 REMOVED 멤버는 다시 초대할 수 있습니다. 재참여 수락 시 기존 Workspace Member 행을 ACTIVE로 복구하고 Workspace Role을 MEMBER로 초기화합니다.

재전송 전용 API는 제공하지 않습니다. 기존 유효한 PENDING 초대가 없을 때 같은 생성 API로 새 초대를 발송합니다.

주요 오류:

- ALREADY_WORKSPACE_MEMBER → 409
- PENDING_INVITATION_EXISTS → 409

## 4.11. Workspace 초대 수락 / 거절

POST /api/workspace-invitations/{invitationId}/accept

POST /api/workspace-invitations/{invitationId}/reject

현재 인증 사용자가 수신한 PENDING 상태의 유효한 초대만 처리할 수 있습니다.

초대 수락 시 ACTIVE 멤버가 새로 중복 생성되지 않도록 다시 검증합니다. 기존 Workspace Member가 LEFT 또는 REMOVED 상태라면 새 행을 만들지 않고 ACTIVE로 복구하며 Workspace Role은 MEMBER로 설정합니다. 이전에 이전된 Project 소유권과 비활성 Project Member는 자동 복구하지 않습니다.

수락 응답 예:

~~~json
{
  "success": true,
  "message": "Workspace 초대를 수락했습니다.",
  "data": {
    "invitationId": 41,
    "status": "ACCEPTED",
    "workspace": {
      "workspaceId": 7,
      "name": "Game Channel Studio",
      "myRole": "MEMBER",
      "activeProjectCount": 0
    }
  }
}
~~~

거절 응답 예:

~~~json
{
  "success": true,
  "message": "Workspace 초대를 거절했습니다.",
  "data": {
    "invitationId": 41,
    "status": "REJECTED"
  }
}
~~~

주요 오류:

- WORKSPACE_INVITATION_NOT_FOUND → 404
- FORBIDDEN_WORKSPACE_INVITATION → 403
- WORKSPACE_INVITATION_NOT_PENDING → 409
- WORKSPACE_INVITATION_EXPIRED → 409
- ALREADY_WORKSPACE_MEMBER → 409

초대 목록을 조회한 뒤 취소 또는 만료될 수 있으므로 수락과 거절 시점에 상태, 수신 사용자와 만료 시각을 서버에서 다시 검증합니다.

## 4.12. Workspace 초대 취소

DELETE /api/workspace-invitations/{invitationId}

권한:

- 해당 Workspace OWNER / ADMIN

현재 시각 기준으로 유효한 PENDING 초대를 CANCELLED로 변경합니다. OWNER와 ADMIN 모두 취소할 수 있으며 이미 처리되거나 만료된 초대는 변경하지 않습니다.

---

# 5. Channel 및 Task Type API

## 5.1. Channel 목록

GET /api/workspaces/{workspaceId}/channels

Query:

- activeOnly: 기본 true
- keyword

관리 화면은 비활성 Channel도 함께 표시하기 위해 `activeOnly=false`로 조회합니다. Project 생성과 일반 선택 UI는 기본값인 `activeOnly=true`를 사용합니다.

Channel의 `integrationStatus`는 다음 값을 사용합니다.

- `MANUAL`: 실제 YouTube 연동 없이 등록
- `CONNECTED`: YouTube 연동과 검증 완료
- `DISCONNECTED`: 기존 연동이 해제됨
- `ERROR`: 연동 또는 동기화 오류

응답에는 OWNER와 ADMIN에게만 `longFormRate`, `shortFormRate`를 String으로 제공합니다. 일반 프로젝트 선택용 Channel 응답과 MEMBER 응답에서는 두 필드를 반환하지 않습니다.

#36 Mock 데이터는 화면 표시 검증을 위해 `MANUAL`, `CONNECTED`, `ERROR` 상태를 모두 포함합니다.

## 5.2. Channel 생성

POST /api/workspaces/{workspaceId}/channels

요청:

~~~json
{
  "name": "테크 리뷰",
  "youtubeChannelId": "UCxxxxxxxx",
  "youtubeChannelUrl": "https://youtube.com/@example",
  "description": "메인 테크 채널",
  "longFormRate": "3.000000",
  "shortFormRate": "0.200000"
}
~~~

- `name`: 필수
- `youtubeChannelId`: 선택, null 허용
- `youtubeChannelUrl`: 선택, null 허용
- `description`: 선택, null 허용
- `longFormRate`: 선택, 0 이상·소수 6자리 이내, 미입력 시 `"0"`
- `shortFormRate`: 선택, 0 이상·소수 6자리 이내, 미입력 시 `"0"`

이름만으로 생성할 수 있으며 생성 시 실제 연동 절차를 거치지 않았으면 `integrationStatus=MANUAL`로 저장합니다. YouTube 채널 ID나 URL이 입력됐다는 이유만으로 `CONNECTED`로 변경하지 않습니다.

권한:

- OWNER
- ADMIN

응답: 201 Created

## 5.3. Channel 수정 / 비활성화 / 재활성화

PATCH /api/workspaces/{workspaceId}/channels/{channelId}

수정 가능:

- name
- youtubeChannelId
- youtubeChannelUrl
- description
- longFormRate
- shortFormRate
- active

비활성 Channel은 `active=true`로 다시 활성화할 수 있습니다. `integrationStatus`는 별도의 실제 YouTube 연동 흐름에서 관리하며 일반 정보 수정 요청이 임의로 변경하지 않습니다. 기본 단가 변경은 기존 YouTubePublication의 `appliedRevenuePerView`를 자동 변경하지 않습니다.

## 5.4. Channel 삭제

DELETE /api/workspaces/{workspaceId}/channels/{channelId}

서버는 삭제 요청 시점에 Project와 Channel을 직접 참조하는 비용·수익 등 업무 데이터의 연결 여부를 최종 확인하며, 연결 이력이 없을 때만 Channel을 물리 삭제합니다.

기존 Project나 업무 데이터에서 사용 중이면 삭제하지 않고 `409 CHANNEL_IN_USE`를 반환합니다. 화면은 삭제 불가 사유와 함께 더 이상 새 Project에서 사용하지 않으려면 비활성화하도록 안내합니다. 연결 여부 확인과 삭제는 하나의 트랜잭션에서 처리하고, 데이터베이스 외래 키도 참조 중 삭제를 제한합니다.

## 5.5. Task Type 목록

GET /api/workspaces/{workspaceId}/task-types

Query:

- activeOnly: 기본 true

관리 화면은 비활성 Task Type도 함께 표시하기 위해 `activeOnly=false`로 조회합니다. 신규 작업 생성 UI는 기본값인 `activeOnly=true`를 사용합니다.

## 5.6. Task Type 생성

POST /api/workspaces/{workspaceId}/task-types

요청:

~~~json
{
  "name": "자막"
}
~~~

Workspace 내 동일 이름은 중복 생성할 수 없습니다. 비교 전 앞뒤 공백을 제거하고 영문 대소문자를 구분하지 않습니다. 같은 이름의 비활성 Task Type이 있으면 중복 생성 오류와 함께 기존 항목 재활성화를 안내합니다.

## 5.7. Task Type 수정 / 비활성화 / 재활성화

PATCH /api/workspaces/{workspaceId}/task-types/{taskTypeId}

기본 제공 Task Type과 사용자 정의 Task Type은 모두 이름 수정, 비활성화와 재활성화가 가능합니다. 비활성 Task Type은 기존 작업 응답에서 유지하지만 신규 작업 생성 후보에서는 제외합니다.

## 5.8. Task Type 삭제

DELETE /api/workspaces/{workspaceId}/task-types/{taskTypeId}

기본 제공 Task Type과 사용자 정의 Task Type에 같은 삭제 규칙을 적용합니다. 서버는 삭제 요청 시점에 `project_tasks` 참조 여부를 최종 확인하며, 참조가 없을 때만 물리 삭제합니다.

기존 작업에서 사용 중이면 삭제하지 않고 `409 TASK_TYPE_IN_USE`를 반환합니다. 화면은 삭제 불가 사유와 함께 더 이상 새 작업에서 사용하지 않으려면 비활성화하도록 안내합니다. 사용 여부 확인과 삭제는 동시 요청으로 참조가 생기는 상황을 막을 수 있도록 하나의 트랜잭션에서 처리하고, 데이터베이스 외래 키도 참조 중 삭제를 제한합니다.

---

# 6. Dashboard 및 Notification API

## 6.1. Dashboard 요약 카드 조회

GET /api/workspaces/{workspaceId}/dashboard/summary

현재 사용자의 Workspace 내 업무 기준으로 집계합니다. 사용자 식별자와 제작팀 권한은 인증 세션 및 제작팀 멤버십에서 결정하며 Query Parameter로 전달받지 않습니다.

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

OWNER와 ADMIN은 현재 제작팀의 관리 가능 업무 범위에서 집계합니다. 일반 MEMBER는 자신이 참여한 Project와 접근 가능한 Task 범위에서 집계하며, 클라이언트가 별도 필터를 조작해도 범위를 넓힐 수 없습니다.

## 6.2. 스케줄러 조회

GET /api/workspaces/{workspaceId}/dashboard/schedule

Query:

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| startDate | Y | YYYY-MM-DD |
| endDate | Y | YYYY-MM-DD |
| status | N | ALL / PLANNING / EDITING / REVIEW / UPLOADED / CANCELLED |
| role | N | ALL / MY_TASK / CREATOR / PLANNER / WRITER / VIDEOGRAPHER / EDITOR / THUMBNAILER |
| channelId | N | Channel 필터 |
| keyword | N | Project / Task 검색, 최대 50자 |

보관된 Project와 CANCELLED Project는 기본 조회에서 제외하고 명시적인 조건에서만 포함합니다.

사용자 식별자와 제작팀 권한은 인증 세션 및 제작팀 멤버십에서 결정합니다. OWNER와 ADMIN은 현재 제작팀의 관리 가능 일정을 조회하고 MEMBER는 자신이 참여한 Project와 접근 가능한 Task 일정만 조회합니다. `role=MY_TASK`는 권한 범위를 확장하지 않으며 허용된 일정 중 현재 사용자에게 배정된 Task만 반환합니다. Workspace, 권한, 날짜 범위와 모든 필터를 적용한 뒤 `calendarEvents`와 `todayDeadlines`를 같은 기준으로 생성합니다.

`calendarEvents.workerAmount`는 Workspace OWNER·ADMIN과 해당 Project의 Owner·ACTIVE EDIT 참여자 응답에 포함합니다. VIEW 참여자에게는 자신이 담당자인 작업의 금액만 포함하고 다른 작업에서는 필드를 제거합니다. 제작팀 전체 재무 정보와 개인 정산 정보의 기존 접근 권한은 그대로 유지합니다.

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

# 7. ProjectGroup(프로젝트 그룹) API

## 7.1. ProjectGroup 목록

GET /api/workspaces/{workspaceId}/project-groups

Query:

- status
- startDate
- endDate
- keyword
- page
- size

기간 필터는 ProjectGroup 기간과 요청 기간이 하루라도 겹치면 포함합니다. 시작일 또는 종료일이 null이면 해당 방향의 제한이 없는 기간으로 취급합니다.

기본 정렬은 ACTIVE, PLANNING, COMPLETED, CANCELLED 순서이며, 같은 상태에서는 startDate 내림차순, startDate가 없으면 createdAt 내림차순으로 정렬합니다.

권한:

- OWNER
- ADMIN

## 7.2. ProjectGroup 생성

POST /api/workspaces/{workspaceId}/project-groups

요청:

~~~json
{
  "name": "신제품 카메라 협찬",
  "description": "롱폼 1편 + Shorts 2편",
  "startDate": "2026-09-01",
  "endDate": "2026-09-30",
  "projectIds": [12, 13, 14],
  "confirmContentPerformanceMove": true
}
~~~

응답: 201 Created

검증:

- name: 필수, 앞뒤 공백 제거 후 1자 이상 150자 이하
- 같은 Workspace에서 앞뒤 공백을 제거하고 영문 대소문자를 구분하지 않은 이름 중복 → 409
- projectIds: 선택, 같은 Workspace에 속하고 아직 다른 ProjectGroup에 연결되지 않은 Project만 허용
- confirmContentPerformanceMove: 선택 Project가 대표인 VideoContent의 콘텐츠 성과를 새 그룹으로 이동하는 경우의 명시적 확인값

생성 상태는 PLANNING입니다. 콘텐츠 성과 이동이 필요한데 확인값이 없으면 `409 CONTENT_PERFORMANCE_MOVE_CONFIRMATION_REQUIRED`를 반환하며 ProjectGroup을 생성하지 않습니다. 여러 Project를 선택한 경우 모든 대상을 먼저 검증하고 ProjectGroup 생성과 연결을 한 번에 반영하여 부분 적용을 금지합니다.

## 7.3. ProjectGroup 상세

GET /api/workspaces/{workspaceId}/project-groups/{projectGroupId}

반환 정보:

- 기본 정보
- 연결 Project 요약
- ProjectGroup 직접 Expense / Revenue 목록 요약
- 연결 Project의 Channel과 상태
- 실제 비용, 실제 수익, 손익과 ROI

실제 비용은 ProjectGroup 직접 ACTIVE Expense, 소속 Project의 지급 대상 Task 금액과 소속 Project 직접 ACTIVE Expense를 합산합니다. 실제 수익은 ProjectGroup 직접 ACTIVE Revenue와 소속 Project 직접 ACTIVE Revenue를 합산합니다. 실제 비용이 0이면 ROI는 null로 반환합니다.

## 7.4. ProjectGroup 수정

PATCH /api/workspaces/{workspaceId}/project-groups/{projectGroupId}

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

COMPLETED / CANCELLED로 변경해도 Expense와 Revenue 등록 및 정정은 허용합니다. 해당 상태에는 새 Project를 연결할 수 없으며 다시 연결하려면 먼저 ACTIVE로 변경합니다.

## 7.5. ProjectGroup에 Project 연결

POST /api/workspaces/{workspaceId}/project-groups/{projectGroupId}/projects

요청:

~~~json
{
  "projectIds": [12, 13],
  "confirmContentPerformanceMove": true
}
~~~

OWNER와 ADMIN만 호출할 수 있습니다. 같은 Workspace에 속하고 다른 ProjectGroup에 연결되지 않은 Project만 연결할 수 있습니다.

선택 Project가 대표인 VideoContent에 동기화된 성과 또는 계산 가능한 예상 플랫폼 수익이 있으면 확인값이 없을 때 `409 CONTENT_PERFORMANCE_MOVE_CONFIRMATION_REQUIRED`를 반환합니다. 모든 Project와 확인값 검증이 끝난 뒤 전체 연결을 한 번에 반영하며 하나라도 실패하면 일부만 연결하지 않습니다.

다른 ProjectGroup에 속한 Project의 이동은 Project 수정 API에서 projectGroupId를 변경합니다. 변경 전 사용자 확인을 거치며 Project 직접 비용·수익의 집계 대상도 함께 바뀝니다.

## 7.6. ProjectGroup에서 Project 연결 해제

DELETE /api/workspaces/{workspaceId}/project-groups/{projectGroupId}/projects/{projectId}?confirmContentPerformanceMove=true

Project 자체와 Project 직접 Expense / Revenue는 유지하고 projectGroupId만 null로 변경합니다.

해제 대상 Project가 대표인 VideoContent에 동기화된 성과 또는 계산 가능한 예상 플랫폼 수익이 있으면 확인값이 없을 때 `409 CONTENT_PERFORMANCE_MOVE_CONFIRMATION_REQUIRED`를 반환하고 연결을 유지합니다.

## 7.7. ProjectGroup 삭제

DELETE /api/workspaces/{workspaceId}/project-groups/{projectGroupId}

연결 Project, 직접 Expense와 직접 Revenue가 모두 없을 때만 삭제합니다. 서버가 삭제 직전에 다시 확인하며 하나라도 존재하면 409와 함께 COMPLETED 또는 CANCELLED 상태 변경을 안내합니다.

---

# 8. Project 및 Project Member API

## 8.1. Project 목록

GET /api/workspaces/{workspaceId}/projects

Query:

| 필드 | 설명 |
| --- | --- |
| status | Project 상태 |
| channelId | Channel 필터 |
| projectGroupId | ProjectGroup 필터 |
| participation | ALL / MINE, MEMBER는 항상 MINE으로 제한 |
| view | ACTIVE / ARCHIVED, 기본 ACTIVE |
| keyword | 제목·기획 내용 검색 |
| page / size | 페이징 |

일반 MEMBER는 자신에게 접근 권한이 있는 Project만 조회합니다. Workspace OWNER와 ADMIN은 전체 Project를 조회하고 participation=MINE으로 자신의 참여 Project만 좁힐 수 있습니다. 기본 정렬은 최근 수정 순이며 논리 삭제 Project는 모든 목록에서 제외합니다.

## 8.2. Project 생성

POST /api/workspaces/{workspaceId}/projects

요청:

~~~json
{
  "title": "카메라 리뷰",
  "content": "제품 소개와 실제 촬영 테스트",
  "channelId": 3,
  "projectGroupId": 7,
  "defaultVideoType": "LONG",
  "status": "PLANNING",
  "dueDate": "2026-09-22",
  "plannedUploadDate": "2026-09-23"
}
~~~

title, channelId와 defaultVideoType은 필수입니다. title은 공백 제거 후 1~150자, content는 선택이며 최대 2,000자입니다. defaultVideoType은 새 VideoContent의 초기값으로 LONG / SHORTS 중 하나이고 기본 미선택입니다. status는 PLANNING / EDITING만 허용하며 누락 시 PLANNING을 사용합니다. dueDate와 plannedUploadDate는 각각 생략할 수 있지만 둘 다 있으면 dueDate가 plannedUploadDate보다 늦을 수 없습니다. 과거 날짜를 허용합니다.

projectGroupId는 null 허용입니다.

projectGroupId는 OWNER 또는 ADMIN만 지정할 수 있습니다. MEMBER가 생성하는 Project는 projectGroupId를 null로 처리하며, 기존 ProjectGroup 연결을 변경하거나 해제할 수도 없습니다.

생성 시:

- 생성자를 owner_member_id로 설정
- 생성자를 Project Member EDIT로 자동 등록
- 요청한 PLANNING 또는 EDITING 상태를 저장하고 최초 상태 이력을 기록
- VideoContent와 YouTubePublication은 자동 생성하지 않음

주요 오류:

- CHANNEL_NOT_IN_WORKSPACE → 400
- PROJECT_GROUP_NOT_IN_WORKSPACE → 400
- PROJECT_GROUP_CLOSED → 409

## 8.3. Project 상세

GET /api/projects/{projectId}

응답 핵심 구조:

~~~json
{
  "success": true,
  "data": {
    "myPermission": "EDIT",
    "workspaceRole": "MEMBER",
    "projectInfo": {
      "projectId": 12,
      "workspaceId": 1,
      "title": "카메라 리뷰",
      "channelId": 3,
      "channelName": "테크 리뷰",
      "projectGroupId": 7,
      "projectGroupName": "신제품 카메라 협찬",
      "defaultVideoType": "LONG",
      "projectStatus": "REVIEW",
      "dueDate": "2026-09-22",
      "plannedUploadDate": "2026-09-23",
      "archived": false
    },
    "projectMembers": [],
    "tasks": [],
    "videoContents": []
  }
}
~~~

일반 MEMBER인 프로젝트 비참여자는 403을 반환합니다. Workspace OWNER와 ADMIN은 Project Member가 아니어도 같은 Workspace의 모든 Project를 조회하고 관리할 수 있으며, 이 조회만으로 채팅 읽음 상태를 만들지 않습니다.

연결된 VideoContent와 YouTubePublication을 함께 반환합니다. Channel 기본 단가, revenueOption, appliedRevenuePerView와 estimatedPlatformRevenue는 Workspace OWNER와 ADMIN 응답에만 포함합니다. 일반 MEMBER에게는 YouTube 조회수·좋아요·댓글 등 공개 성과 지표만 반환합니다.

## 8.4. Project 수정

PATCH /api/projects/{projectId}

수정 가능:

- title
- content
- channelId
- projectGroupId
- defaultVideoType
- dueDate
- plannedUploadDate
- status

권한:

- Owner
- EDIT
- 필요한 Workspace 관리자

VIEW는 수정할 수 없습니다. 프로젝트 소유자와 EDIT 참여자는 기본 정보·일정·상태를 수정할 수 있고 Workspace OWNER와 ADMIN은 참여 여부와 무관하게 같은 권한을 가집니다.

projectGroupId의 지정, 변경과 null 해제는 Workspace OWNER와 ADMIN만 수행할 수 있습니다. Project Owner 또는 EDIT 권한만 가진 사용자는 다른 수정 가능 필드를 변경할 수 있더라도 projectGroupId는 변경할 수 없습니다.

ProjectGroup을 변경하면 Project 직접 Expense / Revenue와 Task 지급 금액의 그룹 집계 대상도 변경됩니다. 해당 Project가 대표인 VideoContent에 동기화된 성과 또는 계산 가능한 예상 플랫폼 수익이 있으면 콘텐츠 성과의 그룹 귀속도 이동합니다. 이 조건 중 하나라도 충족하면 클라이언트가 실제 재무와 참고용 콘텐츠 성과의 영향을 구분해 확인하고, 영향 데이터가 없으면 바로 저장합니다. COMPLETED / CANCELLED ProjectGroup은 지정할 수 없습니다.

channelId와 defaultVideoType 변경은 앞으로 생성하는 VideoContent와 YouTubePublication의 기본값에만 영향을 줍니다. 기존 결과물의 영상 유형, 게시 Channel과 적용 단가를 자동 변경하지 않습니다.

상태는 모든 값 사이의 변경을 허용하고 변경 전후 상태, 변경자와 변경 시각을 이력으로 기록합니다. UPLOADED 변경이 YouTube 연결이나 동기화를 실행하지 않으며 보관 Project를 PLANNING / EDITING / REVIEW로 변경하면 보관을 자동 해제합니다.

## 8.5. Project 보관 / 보관 해제

POST /api/projects/{projectId}/archive

DELETE /api/projects/{projectId}/archive

보관은 Project 상태와 별개입니다.

UPLOADED / CANCELLED Project만 보관할 수 있습니다. 프로젝트 소유자와 Workspace OWNER / ADMIN만 호출할 수 있으며 보관 시 archived_at과 archived_by_member_id를 기록합니다.

## 8.6. Project 논리 삭제

DELETE /api/projects/{projectId}

요청 본문은 삭제할 Project가 대표인 VideoContent마다 새 대표 Project를 지정할 때 사용합니다.

~~~json
{
  "primaryProjectReassignments": [
    {
      "videoContentId": 31,
      "newPrimaryProjectId": 12
    }
  ],
  "confirmContentPerformanceMove": true
}
~~~

프로젝트 소유자와 Workspace OWNER / ADMIN만 호출할 수 있습니다. 다른 활성 연결 Project가 있는 VideoContent는 새 대표를 반드시 명시해야 하며, 후보가 하나뿐이어도 서버가 임의 이전하지 않습니다. 대표 변경과 논리 삭제는 하나의 트랜잭션으로 처리합니다. 후보가 없으면 삭제된 Project를 역사적 대표로 계속 참조하고 연결을 유지하되 활성 Project·ProjectGroup 콘텐츠 성과 집계에서 제외합니다.

새 대표가 같은 ProjectGroup에 있거나 양쪽 모두 그룹이 없으면 삭제 요청자에게 두 Project의 관리 권한이 있어야 합니다. 그룹 경계를 넘으면 Workspace OWNER 또는 ADMIN만 수행할 수 있습니다. 콘텐츠 성과 또는 계산 가능한 예상 플랫폼 수익이 다른 그룹으로 이동할 때 `confirmContentPerformanceMove`가 없으면 영향 정보를 포함한 409를 반환합니다. 하위 업무 이력과 대표 변경 이력을 유지하고 deleted_at / deleted_by_member_id를 기록합니다. 삭제 Project는 업무 목록, 보관함, 일정, 검색과 콘텐츠 성과에서 제외하지만 실제 Expense, Revenue와 확정 Settlement는 재무 합계에서 유지합니다.

## 8.7. Project Member 목록 및 추가 후보 조회

GET /api/projects/{projectId}/members

현재 Project의 활성 참여자를 먼저 반환하고 현재 참여 종료자는 별도 목록으로 구분합니다. 이름, 이메일, 전문 역할, EDIT / VIEW 권한, 참여 상태, 소유자 여부, 현재 Workspace Member 상태(`ACTIVE / LEFT / REMOVED`), 현재 참여·종료 시각을 제공합니다. Project 참여자와 Workspace OWNER / ADMIN이 조회할 수 있습니다. 화면은 현재 참여 종료자라도 Workspace Member가 ACTIVE일 때만 재참여 동작을 제공해야 합니다.

Task 담당자 후보를 조회할 때는 `active=true&permissionLevel=EDIT` 조건을 사용합니다. 이 목록은 #18의 Task 생성·수정 화면에서 재사용하며 VIEW와 참여 종료 사용자는 기존 담당 이력에만 표시합니다.

GET /api/projects/{projectId}/member-candidates

같은 Workspace의 ACTIVE Member 중 현재 ACTIVE Project Member가 아닌 사용자를 반환합니다. 현재 비활성 Project Member인 멤버에는 기존 `projectMemberId`를 함께 제공하여 재참여임을 구분합니다.

GET /api/projects/{projectId}/members/{projectMemberId}/histories

Project Owner와 Workspace OWNER / ADMIN만 호출할 수 있습니다. Project Member의 BASELINE·참여·재참여·권한 변경·참여 종료 이력과 해당 멤버가 이전 또는 신규 Owner였던 소유권 이전 이력을 시간순으로 조합해 반환합니다. 화면 응답에는 처리자 이름을 제공하되 이메일은 포함하지 않습니다.

기존 Project Member의 BASELINE은 기존 `joinedAt`, 현재 권한·활성 상태와 SYSTEM 처리자를 사용합니다. 알 수 없는 과거 권한 변경이나 재참여는 생성하지 않습니다.

### Project Member 변경 API 공통 동시성 규칙

Project Member 추가·재참여·권한 변경·제외·소유권 이전과 Workspace 멤버 제외·탈퇴는 Workspace 단위 직렬화 경계에서 처리합니다. 실제 데이터베이스에서는 관련 `workspace_members`를 ID 오름차순으로 잠그고 `video_projects`, `project_members`를 각각 ID 오름차순으로 잠급니다.

각 요청은 잠금 이후 요청자 권한, Workspace Member 상태, Project 보관·삭제 상태와 Project Member의 최신 상태를 다시 검증합니다. 저장 직전에는 `video_projects.owner_member_id`가 같은 Project의 ACTIVE EDIT Project Member를 가리키는지 재검증합니다. 먼저 완료된 요청으로 조건이 달라졌으면 현재 요청 전체를 롤백하고 최신 목록 재조회가 필요한 409를 반환합니다.

Mock API는 같은 규칙을 Workspace 단위 변경 큐로 구현합니다. 큐 안에서 최신 저장 상태를 다시 읽고 추가 비동기 대기 없이 한 번에 검증·변경하며, 비동기 조회 전에 읽은 Project 전체 객체로 최신 상태를 덮어쓰지 않습니다.

## 8.8. Project Member 추가

POST /api/projects/{projectId}/members

요청:

~~~json
{
  "workspaceMemberIds": [25, 26],
  "permissionLevel": "EDIT"
}
~~~

한 명만 추가할 때도 길이 1의 `workspaceMemberIds` 배열을 사용합니다. Workspace에 속하지 않은 사용자, 비활성 Workspace Member 또는 이미 ACTIVE인 Project Member를 직접 추가할 수 없습니다.

프로젝트 소유자와 Workspace OWNER / ADMIN만 추가할 수 있습니다. 화면에서는 제작팀 초대와 혼동하지 않도록 `참여자 추가`로 표시하며 검색 결과가 없으면 새 멤버 초대를 제작팀 관리자에게 요청하도록 안내합니다.

요청 대상 전체를 공통 직렬화·잠금 경계에서 검증한 뒤 하나의 트랜잭션으로 추가합니다. 한 명이라도 검증에 실패하면 아무도 추가하지 않고 충돌 대상을 반환합니다. 현재 참여 종료 상태이면 기존 Project Member를 재활성화하고 요청 권한과 새 참여 시각을 기록하며 `leftAt`을 비웁니다.

EDIT로 재참여하면 여전히 같은 Project Member를 담당자로 참조하는 미완료 Task의 담당 자격이 자동 회복됩니다. 응답에는 `restoredIncompleteTaskCount`를 포함하여 화면이 영향을 안내할 수 있게 합니다. 다른 담당자로 변경된 Task와 완료 Task는 변경하지 않으며 VIEW 재참여는 담당 자격을 회복하지 않습니다.

최초 추가는 JOINED, 기존 Project Member 재활성화는 REJOINED 이력을 같은 트랜잭션에서 기록합니다.

## 8.9. Project Member 권한 수정

PATCH /api/projects/{projectId}/members/{projectMemberId}

요청:

~~~json
{
  "permissionLevel": "VIEW"
}
~~~

현재 Owner의 Project Member를 VIEW로 내릴 수 없습니다.

프로젝트 소유자와 Workspace OWNER / ADMIN만 권한을 변경할 수 있습니다. EDIT 참여자는 참여자와 권한을 조회할 수 있지만 변경할 수 없습니다.

VIEW에서 EDIT로 변경하는 요청은 즉시 처리할 수 있습니다. EDIT에서 VIEW로 변경해도 기존 Task 담당자 참조는 보존하며, 미완료 Task에는 담당자 재지정 필요 상태를 응답합니다.

성공한 변경은 PERMISSION_CHANGED 이력을 같은 트랜잭션에서 기록합니다.

## 8.10. Project Member 제거

DELETE /api/projects/{projectId}/members/{projectMemberId}

현재 Owner는 제거할 수 없습니다.

프로젝트 소유자와 Workspace OWNER / ADMIN만 제거할 수 있습니다.

제거는 Project Member를 삭제하지 않고 비활성화하여 `leftAt`을 기록합니다. 기존 Task 담당자 참조와 완료 이력은 보존하며 미완료 Task에는 담당자 재지정 필요 상태를 응답합니다. Workspace OWNER·ADMIN이 자신의 Project Member를 제거해도 Workspace 관리 권한은 유지되지만 프로젝트 채팅 참여는 종료됩니다.

성공한 제거는 LEFT 이력을 같은 트랜잭션에서 기록합니다. Workspace 제외·탈퇴로 비활성화된 경우 `changeSource=WORKSPACE_MEMBERSHIP`을 사용합니다.

## 8.11. Project Owner 이전

POST /api/projects/{projectId}/transfer-owner

요청:

~~~json
{
  "newOwnerProjectMemberId": 45
}
~~~

현재 Project 소유자와 Workspace OWNER / ADMIN만 논리 삭제되지 않은 Project의 소유권을 이전할 수 있습니다. 새 Owner는 같은 Project의 다른 ACTIVE EDIT Project Member여야 합니다. 보관 Project에서도 이 조건을 만족하는 소유권 이전만 허용하고 보관 상태는 유지합니다.

VIEW 참여자, 참여 종료 사용자나 Project 미참여자를 자동 추가·재활성화·승격하지 않습니다. 화면에서는 대상 이름과 이메일 및 이전 영향을 표시하고 대상 이메일을 정확히 입력한 경우에만 요청을 전송합니다.

응답 성공 후 기존 Owner는 일반 EDIT Member로 남습니다.

소유권 변경과 `project_owner_histories` 추가는 같은 트랜잭션에서 처리합니다. 제외 요청은 공통 잠금 순서에 따라 커밋 직전에 남은 비삭제 소유 Project를 다시 검증합니다. 초기 범위에는 일괄 이전 API를 추가하지 않습니다.

보관된 Project의 8.8~8.10 변경 API는 `INVALID_RESOURCE_STATE`를 반환합니다. 8.11 소유권 이전과 참여자·감사 이력 조회는 허용합니다.

---

# 9. Task API

공통 권한:

- Project 조회 권한자는 작업 목록과 이력을 조회할 수 있습니다.
- Project Owner, ACTIVE EDIT Project Member와 Workspace OWNER·ADMIN은 작업 생성·수정·상태 변경·논리 삭제·복원 권한을 동일하게 가집니다.
- VIEW Project Member는 변경할 수 없습니다.
- 보관 Project에서는 조회 API만 허용합니다. Project의 PLANNING / EDITING / REVIEW / UPLOADED / CANCELLED 상태는 작업 변경을 제한하지 않습니다.
- CONFIRMED Settlement Item에 포함된 작업은 조회 전용이며 변경 요청에 `TASK_ALREADY_SETTLED`를 반환합니다.

금액 공개:

- Project Owner, ACTIVE EDIT Project Member와 Workspace OWNER·ADMIN 응답에는 모든 작업의 `workerAmount`를 포함합니다.
- VIEW Project Member에게는 자신이 담당자인 작업의 `workerAmount`만 제공하고 다른 작업에는 필드를 포함하지 않습니다.
- 작업 이력의 금액 변경 전후 값도 같은 공개 기준을 적용합니다.

## 9.1. Task 목록

GET /api/projects/{projectId}/tasks

Query:

- keyword: 작업 내용, 작업 종류 또는 담당자 이름
- taskTypeId
- assigneeProjectMemberId
- status
- mineOnly
- includeDeleted: 기본 false
- page: 기본 0
- size: 기본 20

기본 정렬은 REVIEW → PROGRESS → WAITING → COMPLETED 순이며 같은 상태에서는 종료일 오름차순, 종료일이 없으면 생성일 내림차순입니다. 일반 작업과 삭제된 작업은 화면에서 각각 독립된 Query와 페이지 상태를 사용합니다.

응답에는 현재 상태, 담당 자격 이상 사유, 최근 반려 정보, version과 현재 사용자가 수행할 수 있는 액션을 포함합니다. 전체 변경 이력은 9.7의 별도 API로 조회합니다.

`taskId` 직접 이동 대상이 현재 페이지에 없으면 클라이언트가 대상 작업을 포함하는 페이지를 조회할 수 있도록 전체 건수와 페이지 메타데이터를 반환합니다.

## 9.2. Task 생성

POST /api/projects/{projectId}/tasks

요청:

| 필드 | 타입 | 필수 | 제약 |
| --- | --- | --- | --- |
| taskTypeId | Long | Y | 같은 Workspace의 활성 Task Type |
| assigneeProjectMemberId | Long | Y | ACTIVE EDIT Project Member |
| content | String | N | 앞뒤 공백 제거 후 1~150자, 빈 문자열은 null 처리 |
| startDate | String | N | YYYY-MM-DD |
| endDate | String | N | YYYY-MM-DD |
| workerAmount | String | Y | 0 이상 |

예:

~~~json
{
  "taskTypeId": 3,
  "assigneeProjectMemberId": 45,
  "content": "인트로 구간 자막 수정",
  "startDate": "2026-09-18",
  "endDate": "2026-09-21",
  "workerAmount": "300000.00"
}
~~~

생성 상태는 WAITING입니다.

전문 역할은 검증하지 않으며 프로필 표시와 담당자 검색·필터에만 사용합니다. 생성 성공 시 `CREATED` 작업 이력을 함께 저장합니다.

Project dueDate 이후의 endDate는 저장을 허용하되 응답 warning에 정확한 Project 마감일을 제공합니다. 화면은 요청 전 사용자 확인도 수행합니다.

## 9.3. Task 수정

PATCH /api/projects/{projectId}/tasks/{taskId}

수정 가능:

- taskTypeId
- assigneeProjectMemberId
- content
- startDate
- endDate
- workerAmount
- expectedVersion

검증:

- endDate < startDate → 400
- Project dueDate 이후 → 저장 허용, 응답 warning 제공 가능
- WAITING / PROGRESS 상태에서만 일반 수정 허용
- 현재 작업의 비활성 Task Type은 그대로 유지할 수 있지만 다른 Task Type으로 변경할 때는 활성 Task Type만 선택 가능
- 담당자는 현재 Project의 ACTIVE EDIT Project Member만 지정 가능
- 실제 값이 변경된 필드만 한 개의 UPDATED 이력으로 기록
- 담당자 변경 시 기존 담당자와 새 담당자에게 알림. 요청자 자신에게 보내는 자기 알림은 생략
- version 불일치 → TASK_VERSION_CONFLICT 409

## 9.4. Task 상태 변경

PATCH /api/projects/{projectId}/tasks/{taskId}/status

요청:

~~~json
{
  "status": "REVIEW",
  "rejectionReason": null,
  "expectedVersion": 3
}
~~~

상태:

- WAITING
- PROGRESS
- REVIEW
- COMPLETED

허용 전이:

- WAITING → PROGRESS
- PROGRESS → REVIEW
- REVIEW → COMPLETED
- REVIEW → PROGRESS: 검수 반려, `rejectionReason` 필수, 최대 500자
- COMPLETED → REVIEW: 완료 취소 확인 후 실행

담당자인 ACTIVE EDIT 참여자는 자신의 작업을 순서대로 변경할 수 있고 작업 변경 권한자는 Project의 모든 작업 상태를 같은 전이 규칙 안에서 조정할 수 있습니다. 담당자가 Project Owner 또는 상태 조정 권한자이면 자신의 REVIEW 작업도 완료할 수 있습니다. 상태 건너뛰기는 허용하지 않습니다.

담당자가 현재 ACTIVE EDIT가 아니면 재지정 전까지 상태 변경을 차단합니다.

COMPLETED 전환 시 completed_at을 기록합니다.

COMPLETED → REVIEW 전환 시 completed_at을 NULL로 바꿉니다. CONFIRMED Settlement Item이 있으면 완료 취소를 거부합니다.

논리 삭제되지 않은 작업이 하나 이상이고 마지막 미완료 작업을 COMPLETED로 바꾼 경우, Project가 UPLOADED / CANCELLED가 아니면 응답에 선택적 Project 상태 전환 안내를 포함합니다. Task 상태 변경과 Project 상태 변경은 별도 요청이며 자동으로 연동하지 않습니다.

잘못된 상태 전이:

- INVALID_TASK_STATUS_TRANSITION → 409
- TASK_ASSIGNEE_REASSIGNMENT_REQUIRED → 409
- TASK_VERSION_CONFLICT → 409

## 9.5. Task 논리 삭제

DELETE /api/projects/{projectId}/tasks/{taskId}

요청은 `expectedVersion`을 전달합니다. Task 상태와 관계없이 논리 삭제할 수 있지만 CONFIRMED Settlement Item에 포함된 작업은 거부합니다.

성공 시 deleted_at / deleted_by_member_id를 기록하고 version을 증가시키며 `DELETED` 이력을 추가합니다. 삭제된 작업은 일반 목록, 일정, 작업 수, 완료 수, 작업자 지급 예정 금액, ProjectGroup 비용, 미완료 작업 수와 검수 요청 집계에서 제외합니다. 영구 삭제 API는 제공하지 않습니다.

## 9.6. Task 복원

POST /api/projects/{projectId}/tasks/{taskId}/restore

요청:

~~~json
{
  "expectedVersion": 5
}
~~~

기존 상태·작업 종류·담당자·일정·금액을 유지하고 deleted_at / deleted_by_member_id를 NULL로 변경한 뒤 version을 증가시키며 `RESTORED` 이력을 추가합니다.

비활성 Task Type은 기존 값으로 유지합니다. 담당자가 ACTIVE EDIT가 아니어도 복원을 허용하지만 응답에 담당자 재지정 필요 상태를 포함하고 상태 변경은 차단합니다.

## 9.7. Task 변경 이력

GET /api/projects/{projectId}/tasks/{taskId}/histories

이력 이벤트:

- CREATED
- UPDATED
- STATUS_CHANGED
- REJECTED
- DELETED
- RESTORED

응답은 이벤트, 이전·이후 상태, 변경 필드의 이전·변경 값, 반려 사유, 처리자와 처리 시각을 제공합니다. 금액 변경 값은 현재 금액 조회 권한에 따라 제거합니다.

## 9.8. Task 알림

- 신규 배정과 담당자 변경 → 새 담당자
- 담당자 변경 → 기존 담당자에게 해제 알림
- 검수 요청 → Project Owner
- 반려와 완료 → 담당자
- 삭제와 복원 → 현재 담당자

요청자와 알림 대상이 같으면 자기 알림은 생성하지 않습니다. 일반 일정·금액 수정만으로는 알림을 생성하지 않습니다.

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

# 11. 영상 결과물 및 YouTube 연동 API

영상 결과물 생성, Project 연결, YouTube 게시물 등록, Project 상태 변경, 외부 API 동기화와 예상 수익 계산을 한 요청에 묶지 않습니다.

## 11.1. 영상 결과물 생성

POST /api/projects/{projectId}/video-contents

요청:

~~~json
{
  "title": "카메라 리뷰 본편",
  "videoType": "LONG"
}
~~~

요청 Project를 `primaryProjectId`로 지정하고 `project_video_contents` 연결을 함께 생성합니다. title과 videoType을 생략하면 Project의 title과 defaultVideoType을 초기값으로 사용합니다. YouTube 게시물은 자동 생성하지 않습니다.

프로젝트 소유자, EDIT 참여자와 Workspace OWNER / ADMIN이 호출할 수 있습니다. 결과물 생성은 Project 상태를 자동 변경하지 않습니다.

## 11.2. 영상 결과물의 Project 연결 관리

POST /api/video-contents/{videoContentId}/projects/{projectId}

DELETE /api/video-contents/{videoContentId}/projects/{projectId}

여러 Project를 하나의 VideoContent에 연결하거나 해제합니다. 모든 대상은 같은 Workspace에 속해야 하며 요청 사용자가 대상 Project를 모두 관리할 수 있는지 검증합니다. 대표 Project 연결은 바로 해제할 수 없으며 먼저 다른 연결 Project를 대표로 지정해야 합니다.

PATCH /api/video-contents/{videoContentId}/primary-project

~~~json
{
  "primaryProjectId": 12,
  "changeReason": "합본 영상의 주 제작 프로젝트 변경",
  "confirmContentPerformanceMove": true
}
~~~

대표 Project는 같은 Workspace의 논리 삭제되지 않은 연결 Project 중에서만 선택할 수 있습니다. 같은 ProjectGroup 안의 변경 또는 양쪽 모두 그룹이 없는 변경은 두 Project를 모두 관리할 수 있는 프로젝트 소유자, EDIT 참여자와 Workspace OWNER·ADMIN이 수행할 수 있습니다. ProjectGroup 경계를 넘는 변경은 Workspace OWNER·ADMIN만 수행할 수 있습니다.

동기화된 성과 또는 계산 가능한 예상 플랫폼 수익의 ProjectGroup 귀속이 바뀌는데 확인값이 없으면 `409 CONTENT_PERFORMANCE_MOVE_CONFIRMATION_REQUIRED`와 영향 정보를 반환합니다. 대표 변경 시 이전·새 Project, 양쪽 ProjectGroup 스냅샷, 사유, 변경자와 시각을 이력으로 기록합니다. 실제 Expense, Revenue, 손익과 ROI는 대표 변경으로 이동하지 않습니다.

## 11.3. YouTube 게시물 등록

POST /api/video-contents/{videoContentId}/youtube-publications

요청:

~~~json
{
  "channelId": 3,
  "youtubeVideo": "https://youtu.be/dQw4w9WgXcQ",
  "publishedAt": null,
  "supersedesPublicationId": null
}
~~~

HTTP·HTTPS의 `youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be` 호스트에서 제공되는 `watch`, `shorts`, 단축 URL 또는 11자리 Video ID를 받아 정규화한 ID를 저장합니다. 호스트 이름은 정확히 일치해야 하며 YouTube가 아닌 호스트에서 같은 형식의 ID를 제공해도 `INVALID_YOUTUBE_VIDEO`로 거부합니다. 동일 Workspace 안에서 이미 등록된 YouTube Video ID는 다시 등록할 수 없습니다. channelId를 생략하면 대표 Project의 담당 Channel을 기본값으로 사용합니다.

재업로드는 기존 게시물의 Video ID를 교체하지 않고 새 YouTubePublication으로 생성합니다. 서로 다른 Channel에는 CURRENT 게시물을 각각 둘 수 있지만 같은 VideoContent와 Channel에는 CURRENT를 최대 하나만 허용합니다. 같은 Channel의 기존 CURRENT가 있을 때는 `supersedesPublicationId`를 명시하여 대체 의사를 확인해야 합니다. 값이 전달되면 대체 대상은 같은 Workspace, VideoContent와 Channel의 실제 CURRENT 게시물과 정확히 일치해야 하며, CURRENT가 없거나 ID가 다르면 `INVALID_PUBLICATION_REPLACEMENT`로 거부합니다. 등록·기존 게시물의 SUPERSEDED 전환·대체 관계 및 상태 이력 기록을 하나의 트랜잭션에서 처리합니다. 게시물 등록과 Project 상태 변경 및 성과 동기화는 서로 자동 실행하지 않습니다.

## 11.4. YouTube 게시물 생명주기 변경

PATCH /api/youtube-publications/{publicationId}

게시 일시 등 일반 정보와 생명주기 변경 의도를 구분해 요청합니다. 상태 표시명은 CURRENT `게시 중`, SUPERSEDED `대체됨`, REMOVED `게시 종료`입니다. REMOVED로 바꿀 때는 `removalReason`에 `UNAVAILABLE` 또는 `INCORRECT`를 필수로 지정합니다. UNAVAILABLE은 누적 성과에 포함하고 INCORRECT는 현재·누적 집계에서 제외합니다.

~~~json
{
  "lifecycleStatus": "REMOVED",
  "removalReason": "UNAVAILABLE",
  "changeReason": "외부 게시 종료",
  "replaceCurrentPublicationId": null
}
~~~

SUPERSEDED 또는 REMOVED를 CURRENT로 복원할 수 있습니다. 같은 Channel에 다른 CURRENT가 있으면 `replaceCurrentPublicationId`로 대체 대상을 명시해야 합니다. 상태·종료 사유·대체 관계 변경과 생명주기 이력 기록은 하나의 트랜잭션에서 처리하며 자기 참조, 순환과 다른 Workspace·VideoContent·Channel 간 대체를 차단합니다. 외부 API의 조회 실패나 일시 오류만으로 REMOVED로 자동 변경하지 않습니다.

GET /api/youtube-publications/{publicationId}/status-histories

변경 전후 상태와 종료 사유, 관련 대체 게시물, 변경자, 시각과 사유를 시간순으로 반환합니다.

## 11.5. YouTube 게시물 예상 수익 설정

PATCH /api/youtube-publications/{publicationId}/revenue-settings

요청:

~~~json
{
  "revenueOption": "DEFAULT",
  "customRevenuePerView": null
}
~~~

revenueOption:

- DEFAULT: 현재 게시 Channel과 VideoContent의 videoType에 맞는 Channel 기본 단가를 새 스냅샷으로 적용
- CUSTOM: customRevenuePerView 필수
- DISABLED: appliedRevenuePerView를 0으로 적용

Workspace OWNER와 ADMIN만 조회·변경할 수 있습니다. Channel 기본 단가가 0이어도 DEFAULT를 정상 저장하며 설정 누락 오류로 처리하지 않습니다.

## 11.6. YouTube 성과 동기화

POST /api/youtube-publications/{publicationId}/sync

외부 API에서 최신 성과를 조회하여 해당 publication_id의 video_performances를 갱신합니다.

응답:

~~~json
{
  "success": true,
  "data": {
    "publicationId": 41,
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

연결 Project의 소유자, EDIT 참여자와 Workspace OWNER / ADMIN이 동기화를 요청할 수 있습니다. 일반 MEMBER 응답에는 조회수, 좋아요, 댓글과 마지막 성공 시각만 포함하고 적용 단가와 예상 플랫폼 수익은 OWNER / ADMIN에게만 포함합니다.

## 11.7. 콘텐츠 성과 집계 조회

GET /api/video-contents/{videoContentId}/performance-summary

현재 성과와 누적 게시 성과를 함께 반환합니다. 현재 성과는 CURRENT, 누적 게시 성과는 CURRENT·SUPERSEDED·REMOVED/UNAVAILABLE의 마지막 성공값을 게시물별로 합산하며 REMOVED/INCORRECT는 모두 제외합니다. 예상 플랫폼 수익도 같은 게시물 범위에서 `viewCount × appliedRevenuePerView`를 게시물별 계산한 뒤 합산합니다.

응답에는 각 집계의 `completeness`(COMPLETE / PARTIAL / UNAVAILABLE), 포함 게시물 수, 한 번도 성공하지 못한 미집계 게시물 수와 게시물별 마지막 성공·시도 시각을 포함합니다. 마지막 성공값에는 임의의 만료 기간을 적용하지 않습니다. 프로젝트 목록은 현재 성과, 프로젝트 상세는 현재·누적, ProjectGroup과 분석 화면은 누적을 주 지표로 사용합니다.

## 11.8. YouTube 관련 오류

| errorCode | HTTP | 의미 |
| --- | --- | --- |
| INVALID_YOUTUBE_VIDEO | 400 | URL / ID 형식 오류 |
| YOUTUBE_VIDEO_NOT_FOUND | 404 | API에서 영상을 확인할 수 없음 |
| DUPLICATE_YOUTUBE_VIDEO | 409 | 같은 Workspace에 이미 YouTubePublication으로 등록 |
| PROJECT_NOT_LINKED_TO_VIDEO_CONTENT | 409 | 대표 Project 또는 해제 대상 Project가 VideoContent에 연결되지 않음 |
| LAST_VIDEO_CONTENT_PROJECT | 409 | VideoContent의 마지막 Project 연결 해제 시도 |
| INVALID_PUBLICATION_REPLACEMENT | 409 | 자기 참조, 순환 또는 다른 VideoContent 게시물로 대체 관계 지정 |
| CURRENT_PUBLICATION_EXISTS | 409 | 같은 VideoContent와 Channel에 CURRENT 게시물이 있으나 명시적 대체 대상 누락 |
| INVALID_REMOVAL_REASON | 400 | REMOVED 상태의 종료 사유 누락 또는 허용되지 않은 값 |
| PRIMARY_PROJECT_REASSIGNMENT_REQUIRED | 409 | Project 삭제 전 다른 활성 연결 Project로 대표 변경 필요 |
| CONTENT_PERFORMANCE_MOVE_CONFIRMATION_REQUIRED | 409 | 대표 또는 ProjectGroup 변경으로 콘텐츠 성과 귀속 이동 확인 필요 |
| CUSTOM_REVENUE_RATE_REQUIRED | 400 | CUSTOM인데 단가 누락 |
| YOUTUBE_API_UNAVAILABLE | 503 | 외부 API 일시 장애 |
| YOUTUBE_QUOTA_EXCEEDED | 503 | API 할당량 제한 |
| YOUTUBE_UPSTREAM_ERROR | 502 | 외부 API 비정상 응답 |

동기화 실패 시 마지막 성공 데이터를 삭제하거나 게시물 생명주기를 변경하지 않습니다. 성공 이력이 없는 게시물은 0이 아닌 미집계로 응답하고, 성공 이력이 있으면 마지막 성공값과 마지막 시도 시각·오류를 함께 반환합니다.

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
- projectGroupId
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
  "projectGroupId": null,
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
- PROJECT_GROUP
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

목록 Query는 Expense와 동일하게 startDate, endDate, revenueType, scopeType, channelId, projectGroupId, projectId, status와 page / size를 사용합니다.

등록 예:

~~~json
{
  "scopeType": "PROJECT_GROUP",
  "projectGroupId": 7,
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

ProjectGroup 상세 화면에서 Expense / Revenue를 등록할 때는 각각 scopeType을 PROJECT_GROUP으로, projectGroupId를 현재 상세 대상 ID로 고정합니다. 계약 예정액, 청구, 입금 여부, 미수금과 세금계산서는 이 API에서 관리하지 않습니다.

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

Project / ProjectGroup의 도메인 성과 데이터를 반환하고 React가 화면에 맞게 시각화합니다.

## 14.1. Project / ProjectGroup 분석 조회

GET /api/workspaces/{workspaceId}/analytics

Query:

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| scopeType | Y | PROJECT / PROJECT_GROUP |
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

ProjectGroup 분석 예:

~~~json
{
  "success": true,
  "data": {
    "scopeType": "PROJECT_GROUP",
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

Channel 또는 Workspace에 직접 귀속된 Expense / Revenue를 ProjectGroup 또는 Project에 임의 배분하지 않습니다.

---

# 15. 공통 오류 코드

## 인증 / 권한

| errorCode | HTTP | 설명 |
| --- | --- | --- |
| INVALID_CREDENTIALS | 401 | 로그인 실패 |
| UNAUTHORIZED_SESSION | 401 | 인증 누락 / 만료 |
| FORBIDDEN_WORKSPACE_ACCESS | 403 | Workspace 접근 불가 |
| FORBIDDEN_WORKSPACE_ADMIN | 403 | Workspace 관리 권한 없음 |
| FORBIDDEN_WORKSPACE_MEMBER_MANAGEMENT | 403 | Workspace 멤버 권한 변경 또는 제외 권한 없음 |
| FORBIDDEN_WORKSPACE_INVITATION | 403 | 현재 사용자가 수신한 Workspace 초대가 아님 |
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
| WORKSPACE_MEMBER_NOT_FOUND | 404 | Workspace 멤버 없음 |
| WORKSPACE_INVITATION_NOT_FOUND | 404 | Workspace 초대 없음 |
| PROJECT_GROUP_NOT_FOUND | 404 | ProjectGroup 없음 |
| CHANNEL_NOT_FOUND | 404 | Channel 없음 |
| TASK_NOT_FOUND | 404 | Task 없음 또는 현재 Project에 속하지 않음 |

## 충돌 / 상태 전이

| errorCode | HTTP | 설명 |
| --- | --- | --- |
| DUPLICATE_EMAIL | 409 | 이메일 중복 |
| ALREADY_WORKSPACE_MEMBER | 409 | 이미 ACTIVE 상태인 Workspace 멤버 |
| PENDING_INVITATION_EXISTS | 409 | 대기 초대 중복 |
| WORKSPACE_INVITATION_NOT_PENDING | 409 | 처리할 수 없는 Workspace 초대 상태 |
| WORKSPACE_INVITATION_EXPIRED | 409 | 만료된 Workspace 초대 |
| ALREADY_PROJECT_MEMBER | 409 | 이미 Project 참여자 |
| LAST_OWNER_REQUIRED | 409 | 마지막 Workspace OWNER 변경 불가 |
| PROJECT_OWNER_CANNOT_BE_REMOVED | 409 | 현재 Project Owner 제거 불가 |
| PROJECT_OWNERSHIP_TRANSFER_REQUIRED | 409 | 멤버 제외·탈퇴 전 비삭제 Project 소유권 이전 필요 |
| PROJECT_MEMBER_STATE_CHANGED | 409 | 동시 요청으로 Project Member 또는 Owner 조건 변경, 최신 목록 재조회 필요 |
| DUPLICATE_YOUTUBE_VIDEO | 409 | Workspace 내 YouTubePublication Video ID 중복 |
| CURRENT_PUBLICATION_EXISTS | 409 | 같은 VideoContent와 Channel의 CURRENT 게시물 대체 확인 필요 |
| INVALID_PUBLICATION_REPLACEMENT | 409 | 허용되지 않는 게시물 대체 관계 |
| PRIMARY_PROJECT_REASSIGNMENT_REQUIRED | 409 | Project 삭제 전 대표 Project 재지정 필요 |
| CONTENT_PERFORMANCE_MOVE_CONFIRMATION_REQUIRED | 409 | 콘텐츠 성과의 ProjectGroup 귀속 이동 확인 필요 |
| CHANNEL_IN_USE | 409 | 기존 Project나 업무 데이터에서 사용 중인 Channel 삭제 불가 |
| INVALID_TASK_STATUS_TRANSITION | 409 | 잘못된 Task 상태 전이 |
| TASK_ASSIGNEE_REASSIGNMENT_REQUIRED | 409 | 담당자가 ACTIVE EDIT가 아니어서 재지정 필요 |
| TASK_VERSION_CONFLICT | 409 | 다른 요청이 Task를 먼저 변경하여 최신 내용 재조회 필요 |
| TASK_ALREADY_SETTLED | 409 | 이미 정산된 Task |
| TASK_TYPE_IN_USE | 409 | 기존 작업에서 사용 중인 작업 종류 삭제 불가 |
| DUPLICATE_PROJECT_GROUP_NAME | 409 | Workspace 내 정규화된 ProjectGroup 이름 중복 |
| PROJECT_GROUP_CLOSED | 409 | 완료 또는 취소된 ProjectGroup에 새 Project 연결 불가 |
| PROJECT_GROUP_IN_USE | 409 | Project, Expense 또는 Revenue가 연결된 ProjectGroup 삭제 불가 |
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
GET  /api/workspace-invitations?status=PENDING
POST /api/workspace-invitations/{id}/accept
POST /api/workspace-invitations/{id}/reject
~~~

## SCR-04 Workspace 관리

~~~text
GET/PATCH/DELETE Workspace Member API
GET/POST/DELETE Invitation API
GET/POST/PATCH/DELETE Channel API
GET/POST/PATCH/DELETE Task Type API
~~~

## SCR-05 Dashboard / Scheduler

~~~text
GET /api/workspaces/{workspaceId}/dashboard/summary
GET /api/workspaces/{workspaceId}/dashboard/schedule
GET /api/notifications
PATCH /api/notifications/{notificationId}/read
/user/queue/notifications
~~~

## SCR-06 ProjectGroup

~~~text
GET   /api/workspaces/{workspaceId}/project-groups
POST  /api/workspaces/{workspaceId}/project-groups
GET   /api/workspaces/{workspaceId}/project-groups/{projectGroupId}
PATCH /api/workspaces/{workspaceId}/project-groups/{projectGroupId}
DELETE /api/workspaces/{workspaceId}/project-groups/{projectGroupId}
POST   /api/workspaces/{workspaceId}/project-groups/{projectGroupId}/projects
DELETE /api/workspaces/{workspaceId}/project-groups/{projectGroupId}/projects/{projectId}
GET/POST/PATCH/VOID Expense API, scopeType=PROJECT_GROUP
GET/POST/PATCH/VOID Revenue API, scopeType=PROJECT_GROUP
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
GET    /api/projects/{projectId}/tasks
POST   /api/projects/{projectId}/tasks
PATCH  /api/projects/{projectId}/tasks/{taskId}
PATCH  /api/projects/{projectId}/tasks/{taskId}/status
DELETE /api/projects/{projectId}/tasks/{taskId}
POST   /api/projects/{projectId}/tasks/{taskId}/restore
GET    /api/projects/{projectId}/tasks/{taskId}/histories
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

## SCR-11A 제작팀 정산 관리

~~~text
Workspace Settlement API
~~~

## SCR-11B 내 정산

~~~text
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
- Workspace 멤버 제외·탈퇴 영향 조회와 현재 사용자 탈퇴 API 추가
- Channel API 신규 추가
- 고정 Task Enum 대신 Workspace Task Type API 도입
- ProjectGroup API 신규 추가
- Project 생성에 Channel, 선택적 ProjectGroup, 일정 정보 추가
- Project Member 추가 대상을 이메일이 아닌 workspaceMemberId로 변경
- Project Owner 이전 API와 Owner 정합성 검증 추가
- Project Member 일괄 추가, 재참여 담당 자격 회복과 멤버별 감사 이력 조회 API 추가
- 보관 Project의 기존 ACTIVE EDIT 참여자 대상 소유권 이전 예외와 공통 동시성 규칙 추가
- assignment 용어를 task로 통일
- assignmentId → taskId
- taskType 문자열 Enum → taskTypeId + taskTypeName
- cost → workerAmount
- Dashboard summary를 최근 활동 목록이 아니라 요약 카드 집계 API로 정리
- 알림 조회와 WebSocket 실시간 알림을 함께 유지하고 읽음 처리 API 추가
- WebSocket 개인 알림 주소를 /user/queue/notifications로 사용
- close-sync API를 영상 결과물, YouTube 게시물 등록과 성과 동기화 API로 분리
- RPM 용어를 제거하고 조회수 1회당 수익 단가로 통일
- calculatedRevenue 저장 개념을 제거하고 estimatedPlatformRevenue를 파생 응답값으로 사용
- YouTube 입력 오류, 영상 없음, 중복 연결, 외부 API 장애를 구분
- Expense / Revenue API 신규 추가
- 재무 데이터 삭제 대신 VOID 처리 Action Endpoint 사용
- 단순 월별 isSettled 조회를 Settlement DRAFT → CONFIRMED → PAID 상태 전이 API로 재설계
- Chat 과거 메시지 조회를 page 방식에서 cursor 방식으로 변경
- Analytics 응답을 특정 차트 UI 구조가 아닌 Project / ProjectGroup 도메인 데이터로 변경
- 400에 몰려 있던 중복 및 상태 충돌을 409 Conflict로 구분

이 문서를 이후 Spring Boot Controller, Request / Response DTO, Service 권한 검증과 React API 모듈 구현의 기준으로 사용합니다.
