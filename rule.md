새로 만들게 될 웹 페이지
=========================

>## 작성규칙
---------

1. 중앙 정렬에 absolute라든지, inline-block을 쓴다든지 하는 불상사가 있다면 슬픕니다. 특정 방향 정렬, 위치 배열은 가급적 flex(동적)나 margin auto(중앙)를 써 주시면 좋겠습니다... 
2. 모든 이미지는 alt 속성을 필히 입력합니다. 그래야 이미지 깨지거나 디버깅할 때 불편함이 없어요
3. 이미 작성된 코드의 클래스명, 변수명, 함수제어 규칙, 메소드 등을 임의로 수정 및 편집하지 마세요. 반드시 사전에 협의 후 조정합니다.
4. 수정 제안은 주석처리한 코드로 제안하면 좋겠습니다.
5. 함수, 기능부 제작시 남이 알아볼 수 있게 주석처리를 필히 합시다.
6. 절대, 파일이나 폴더 이름에 한국어, 일본어, 중국어 등은 쓰지 맙시다. 프로젝트에 파이썬 코드가 다소 포함되기 때문에 이름을 못 읽는 불상사가 생겨요.
7. 모든 파일 이름은 절대 띄어쓰기를 쓰지 않습니다. 정 띄어쓰려면 _(언더바, 쉬프트 마이너스)로 대신 입력해주세요. 파이썬이 띄어쓰기를 잘 못알아 먹어서서요...

***

> ### Class Name 규칙

+ 모든 클래스 명칭의 띄어쓰기는 대쉬(-)를 사용합니다.
+ 숫자와 문자 사이는 대쉬를 써주세요.
+ 대문자, 언더바는 쓰지 않습니다.
  
예시 보고 가세요

    item-container, logo-text, section-container-mobile, section-1-button-2
    
이미지는 img, 텍스트는 text와 같이 남이 봐도 아 이거 그거구나~ 할 수 있게ㅇㅇ

> ### 변수명 표기법

+ 모든 변수 명칭은 띄어쓰기, 대쉬, 언더바를 쓰지 않습니다.
+ 카멜 명명법으로 변수명을 짓도록 합시다. 띄어쓰기 대신 대문자 쓰면 된다는 말입니다.
+ 한 단어로 끝나면 그냥 한 단어 쓰면 됩니다.

카멜을 모른다면? 예시 보고 가십쇼

    navBtn, logoImg, contentViewer, iReallyLikeMoney, weight, xAxis
    
변수는 서로 알아보기 쉽게 이름 짓도록 합시다. 여의치 않으면 각주처리로 설명이라도 해주세요요

***

## 업로드 및 프로젝트 관리

1. 풀 리퀘스트(PR): 원본에서 바로바로 수정하다가 서로 만진 내용 중복되는 불상사가 생기면 최악의 경우 모든 코드를 갈아엎을 수 있습니다. commit, pull을 막 눌러버리면 슬퍼요
   그러니, 반드시 큰 규모의 수정 요청이 있을 경우에는 request 폴더에 "수정자성명_수정할파일명_날짜"형태로 파일 이름 적어서 commit 해주세요. 리뷰어가 검토후 적용합니다.
   - 파일을 새로 만들고(text), 제목을 위처럼 짓고, 내용물에 수정사항을 적으시면 됩니다.

2. 작은 규모의 수정이나 오탈자 처리 정도는 그냥 그 파일에 각주로 달아버려도 무방합니다.

3. 리뷰: 우리 js기본 이상은 하니까 리뷰는 자유롭게, 상대 코드에 각주 달아서 의문점 제기해도 좋음.

4. GPT를 써서 작성한 코드 영역은 꼭 각주로 GPT 표기 해주세요. 그러면 이상한 휴먼 인텔리전스가 코드를 검토한다고 합니다.


***


## 페이지 html 구성

index.html은 필수로 들어가야 해서 일단 넣어 두었고, 여기서 리다이렉션 하든 아니면 처음 들어가는 메인페이지를 잡을지는 먼 훗날에에 결정을 해 보아요
