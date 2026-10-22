import { decodeInputResponse, type MessageValue, type RunResponse } from "./contracts.ts";

/** One pending line per execution; replies travel on the private output port. */
export function inputChannel(port: MessagePort, send: (message: RunResponse) => void) {
    let sequence = 0;
    let pending: { id: number; resolve: (value: string | null) => void } | undefined;
    port.addEventListener("message", (event: MessageEvent<MessageValue>) => {
        const response = decodeInputResponse(event.data);
        if (!response) return;
        if (pending?.id !== response.id) return;
        const { resolve } = pending;
        pending = undefined;
        resolve(response.value);
    });
    port.start();
    return (prompt: string | number | boolean | null = ""): Promise<string | null> => {
        if (pending)
            return Promise.reject(
                new Error("Wait for the previous input before requesting another line"),
            );
        return new Promise((resolve) => {
            const id = ++sequence;
            pending = { id, resolve };
            send({ type: "input", id, prompt: String(prompt).slice(0, 1000) });
        });
    };
}

export const installPythonInput = String.raw`
import builtins as __pg_builtins
from pyodide.ffi import run_sync as __pg_run_sync, can_run_sync as __pg_can_run_sync, jsnull as __pg_jsnull
from _playground import request_input as __pg_request_input, input_unsupported as __pg_input_unsupported

async def read_input(prompt=""):
    value = await __pg_request_input(str(prompt))
    if value is None or value is __pg_jsnull:
        raise EOFError("EOF when reading a line")
    return value

def __pg_input(prompt=""):
    if not __pg_can_run_sync():
        raise RuntimeError(__pg_input_unsupported)
    return __pg_run_sync(read_input(prompt))

__pg_builtins.input = __pg_input
`;
