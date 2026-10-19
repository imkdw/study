const button = document.getElementById("counter-button");
const countText = document.getElementById("count");

let count = 0;

button.addEventListener("click", () => {
  count += 1;
  countText.textContent = count;

  // 숫자가 바뀔 때마다 살짝 튀는 애니메이션을 다시 걸어준다
  countText.classList.remove("bump");
  void countText.offsetWidth;
  countText.classList.add("bump");
});

// 서버에 등록된 API 들을 fetch 로 호출해 보고 응답을 화면에 찍는다
const apis = {
  login: () =>
    fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dongwoo@example.com", password: "1234" }),
    }),

  "profile-image": () => {
    const file = document.getElementById("profile-file").files[0];
    if (!file) {
      throw new Error("업로드할 이미지 파일을 먼저 골라주셈");
    }

    // 서버가 req 스트림을 그대로 파일에 쓰므로 FormData 가 아니라 파일 자체를 본문으로 보낸다
    return fetch("/profile-image", {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
  },

  user: () =>
    fetch("/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dongwoo" }),
    }),

  "not-found": () => fetch("/not-found"),
};

const callApi = async (name) => {
  const result = document.querySelector(`[data-result="${name}"]`);
  result.className = "result";
  result.textContent = "호출 중...";

  const startedAt = performance.now();

  try {
    const response = await apis[name]();
    const elapsed = Math.round(performance.now() - startedAt);
    const text = await response.text();

    let body = text;
    try {
      body = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // JSON 이 아니면 받은 텍스트 그대로 보여준다
    }

    result.classList.add(response.ok ? "ok" : "fail");
    result.textContent = `${response.status} ${response.statusText} (${elapsed}ms)\n${response.headers.get("Content-Type") ?? ""}\n\n${body}`;
  } catch (error) {
    result.classList.add("fail");
    result.textContent = `요청 실패: ${error.message}`;
  }
};

document.querySelectorAll(".call").forEach((callButton) => {
  callButton.addEventListener("click", () => callApi(callButton.dataset.api));
});

document.getElementById("call-all").addEventListener("click", async () => {
  for (const name of Object.keys(apis)) {
    await callApi(name);
  }
});
