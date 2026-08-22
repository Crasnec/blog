/**
 * The comment form, the character counter, and the prompt before leaving.
 *
 * Posting goes straight from the browser to a `workflow_dispatch` in the
 * comment repository — there is nothing of ours in between. The token that
 * authorises it is public and is scoped to that repository's Actions API.
 * Validation is the workflow's job and happens again there; what runs here only
 * saves a round trip.
 *
 * GitHub's API allows the `Authorization` header cross-origin and returns a
 * readable response, so a submission can be honestly reported as accepted or
 * failed rather than fired blindly into the dark.
 */

const AUTHOR_STORAGE_KEY = "comments.author";

function readStoredAuthor(): string {
	try {
		return localStorage.getItem(AUTHOR_STORAGE_KEY) ?? "";
	} catch {
		return "";
	}
}

function storeAuthor(author: string) {
	try {
		if (author) localStorage.setItem(AUTHOR_STORAGE_KEY, author);
		else localStorage.removeItem(AUTHOR_STORAGE_KEY);
	} catch {
		// Storage may be unavailable in a restricted browsing context. The form
		// still works for the current page, so persistence remains optional.
	}
}

export function mountComments() {
	wireForm();
	wireLeavePrompt();
}

/* — the form ——————————————————————————————————— */

function wireForm() {
	const form = document.getElementById("comment-form") as HTMLFormElement | null;
	const status = document.getElementById("comment-status");
	if (!form || !status) return;

	const authorInput = form.elements.namedItem("author") as HTMLInputElement | null;
	if (authorInput) {
		const max = authorInput.maxLength > 0 ? authorInput.maxLength : Infinity;
		authorInput.value = readStoredAuthor().slice(0, max);
		authorInput.addEventListener("input", () => {
			storeAuthor(authorInput.value.trim());
		});
	}

	const { endpoint, token, branch, post, lang, sending, sent, failed } =
		form.dataset;
	if (!endpoint || !token) return;

	const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
	const body = document.getElementById("comment-body") as HTMLTextAreaElement | null;
	const count = document.getElementById("comment-count");
	const resetForm = () => {
		const author = readStoredAuthor();
		form.reset();
		if (authorInput) authorInput.value = author;
		body?.dispatchEvent(new Event("input"));
	};

	if (body && count) {
		const max = Number(body.dataset.max ?? 0);
		const paint = () => {
			count.textContent = `${body.value.length.toLocaleString()} / ${max.toLocaleString()}`;
			// The last tenth is where a limit starts mattering to whoever is typing.
			count.classList.toggle("is-near", body.value.length > max * 0.9);
		};
		body.addEventListener("input", paint);
		paint();
	}

	const say = (message: string, kind: "ok" | "error" | "busy") => {
		status.textContent = message;
		status.hidden = false;
		status.classList.toggle("is-ok", kind === "ok");
		status.classList.toggle("is-error", kind === "error");
	};

	const field = (data: FormData, name: string): string => {
		const value = data.get(name);
		return typeof value === "string" ? value.trim() : "";
	};

	const submit = async (event: SubmitEvent) => {
		event.preventDefault();

		const data = new FormData(form);
		const author = field(data, "author");
		const text = field(data, "body");

		// The honeypot is only ever filled by something that is not reading the
		// page. Report success and send nothing: a bot told it failed just retries.
		if (field(data, "website") !== "") {
			say(sent ?? "", "ok");
			resetForm();
			return;
		}

		if (!author || !text) return;

		if (button) button.disabled = true;
		say(sending ?? "", "busy");

		try {
			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/vnd.github+json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					ref: branch ?? "main",
					inputs: { post: post ?? "", author, body: text, lang: lang ?? "" },
				}),
			});

			// A dispatch that is accepted returns 204 with no body.
			if (!response.ok) throw new Error(String(response.status));

			say(sent ?? "", "ok");
			resetForm();
		} catch {
			say(failed ?? "", "error");
		} finally {
			if (button) button.disabled = false;
		}
	};

	form.addEventListener("submit", (event) => {
		void submit(event);
	});
}

/* — leaving the site ——————————————————————————— */

/**
 * Asks before following a link out of a comment.
 *
 * Only a plain left click is intercepted. A middle click or a modifier click is
 * someone deliberately opening a new tab, and taking that over would be worse
 * than the thing this is guarding against.
 */
function wireLeavePrompt() {
	const panel = document.getElementById("leave-panel");
	const host = document.getElementById("leave-host");
	const url = document.getElementById("leave-url");
	const go = document.getElementById("leave-go") as HTMLAnchorElement | null;
	const cancel = document.getElementById("leave-cancel");
	if (!panel || !host || !url || !go || !cancel) return;

	let lastFocused: HTMLElement | null = null;

	const close = () => {
		panel.classList.remove("is-open");
		window.setTimeout(() => {
			panel.hidden = true;
		}, 200);
		lastFocused?.focus();
	};

	const open = (href: string, hostname: string) => {
		lastFocused = document.activeElement as HTMLElement;
		host.textContent = hostname;
		url.textContent = href;
		go.href = href;

		panel.hidden = false;
		requestAnimationFrame(() => {
			panel.classList.add("is-open");
			// Focus lands on the way out, not on the way through: the reader has to
			// mean it.
			cancel.focus();
		});
	};

	document.addEventListener("click", (event) => {
		if (event.defaultPrevented || event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

		const target = event.target as Element | null;
		const link = target?.closest<HTMLAnchorElement>(
			".comment-body a[data-external]",
		);
		if (!link) return;

		event.preventDefault();
		open(link.href, link.dataset.host ?? link.hostname);
	});

	cancel.addEventListener("click", close);
	go.addEventListener("click", close);

	panel.addEventListener("click", (event) => {
		if (event.target === panel) close();
	});

	panel.addEventListener("keydown", (event) => {
		if (event.key === "Escape") close();
	});
}
