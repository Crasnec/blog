import {
	openWith,
	parsePrivateKeyFile,
	parseSecretPayload,
	type PrivateKeyFile,
	type SecretPayload,
} from "../utils/secret";
import { parseJson } from "../utils/json";

/**
 * Unlocking a locked post.
 *
 * The page ships ciphertext and this form; nothing else about the body is on
 * it. Deriving the key is deliberately slow — about a second — so the button
 * says what is happening rather than appearing to have missed the click.
 *
 * The passphrase is never stored. Reloading asks again, which is the correct
 * behaviour for something a reader may be reading on someone else's machine.
 *
 * Two things are shipped: the post's ciphertext, and the repository's private
 * key wrapped in that same passphrase. The reader needs nothing but the
 * passphrase — no key to install, no file to have been sent.
 */
export function mountSecret() {
	const shell = document.getElementById("secret");
	const form = document.getElementById("secret-form") as HTMLFormElement | null;
	const input = document.getElementById("secret-input") as HTMLInputElement | null;
	const button = form?.querySelector<HTMLButtonElement>("button[type=submit]");
	const status = document.getElementById("secret-status");
	const body = document.getElementById("secret-body");
	const source = document.getElementById("secret-payload");
	const wrapped = document.getElementById("secret-key");
	if (!shell || !form || !input || !status || !body || !source || !wrapped) {
		return;
	}

	let payload: SecretPayload;
	let key: PrivateKeyFile;
	try {
		const decodedPayload = parseSecretPayload(parseJson(source.textContent));
		const decodedKey = parsePrivateKeyFile(parseJson(wrapped.textContent));
		if (!decodedPayload || !decodedKey) return;
		payload = decodedPayload;
		key = decodedKey;
	} catch {
		return;
	}

	const { working, wrong } = form.dataset;

	const submit = async (event: SubmitEvent) => {
		event.preventDefault();

		const passphrase = input.value;
		if (!passphrase) return;

		if (button) button.disabled = true;
		status.textContent = working ?? "";
		status.classList.remove("is-error");
		status.hidden = false;

		// Yield a frame so the label paints before the key derivation blocks.
		await new Promise((resolve) => requestAnimationFrame(resolve));

		const opened = await openWith(key, passphrase, payload);

		if (opened === null) {
			status.textContent = wrong ?? "";
			status.classList.add("is-error");
			if (button) button.disabled = false;
			input.select();
			return;
		}

		body.innerHTML = opened.html;
		shell.remove();

		/*
		 * Diagrams are drawn by a script that ran long before this HTML existed,
		 * so the renderer has to be asked again. Everything else in the body is
		 * plain markup or CSS and needs nothing.
		 */
		if (body.querySelector(".diagram[data-mermaid]")) {
			const { renderDiagrams } = await import("./diagrams");
			await renderDiagrams();
		}

		body.querySelector<HTMLElement>("h2, h3, p")?.focus();
	};

	form.addEventListener("submit", (event) => {
		void submit(event);
	});
}
