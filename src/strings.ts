/**
 * Every word the interface says.
 *
 * The posts here are written in Korean and this is not, which is a choice about
 * who the chrome is for rather than an oversight. It is also why there is no
 * translation layer: one object, one language, looked up by key.
 */

export const ui = {
	"nav.posts": "Posts",
	"nav.archive": "Archive",
	"nav.categories": "Categories",
	"nav.tags": "Tags",
	"nav.about": "About",

	"action.search": "Search",
	"action.menu": "Menu",
	"action.theme": "Appearance",
	"action.language": "Language",
	"action.backToTop": "Back to top",
	"action.close": "Close",
	"action.skip": "Skip to content",

	"theme.light": "Light",
	"theme.dark": "Dark",
	"theme.auto": "System",

	"search.placeholder": "Search posts",
	"search.empty": "Nothing found.",
	"search.loading": "Loading the index",

	"index.all": "All posts",
	"index.empty": "Nothing published yet.",
	"index.browse": "Browse posts",
	"index.count": "posts",
	"index.countOne": "post",

	"post.updated": "Updated",
	"post.readingTime": "min",
	"post.prev": "Previous",
	"figure.replay": "Replay",
	"playground.code": "Code editor",
	"playground.run": "Run",
	"playground.stop": "Stop",
	"playground.reset": "Reset code",
	"playground.output": "Output",
	"playground.outputEmpty": "Run the code to see its output.",
	"playground.idle": "Ready",
	"playground.loading": "Loading runtime…",
	"playground.running": "Running…",
	"playground.done": "Finished",
	"playground.failed": "Execution failed",
	"playground.stopped": "Stopped",
	"playground.timedOut": "Time limit reached",
	"playground.loadTimeout": "Runtime could not load. Try again.",
	"playground.outputLimit": "Output limit reached",
	"playground.plotLimit": "Plot limit reached",
	"playground.downloadPlot": "Download PNG",
	"playground.pythonLibraries": "Available on import: NumPy, pandas, SciPy, Matplotlib and Seaborn.",
	"playground.grammar": "TextMate grammar",
	"playground.grammarFile": "Load grammar files (first file is the main grammar)",
	"playground.grammarReset": "Reset grammar",
	"playground.grammarLoading": "Loading syntax highlighting…",
	"playground.grammarActive": "Highlighting:",
	"playground.grammarError": "Could not apply grammar:",
	"playground.grammarTimeout": "Grammar took too long. Reset it or load another file.",
	"playground.needsJs": "Enable JavaScript to edit and run this code.",
	"post.next": "Next",
	"post.category": "Category",
	"post.tags": "Tags",
	"post.info": "Details",
	"post.readIn": "Read in another language",

	"archive.title": "Archive",

	"categories.title": "Categories",

	"tags.title": "Tags",

	"toc.title": "Contents",

	"comments.title": "Comments",
	"comments.empty": "No comments yet.",
	"comments.form": "Leave a comment",
	"comments.name": "Name",
	"comments.body": "Comment",
	"comments.submit": "Post",
	"comments.sending": "Sending",
	"comments.sent": "Received. It will appear after review, at the next deploy.",
	"comments.failed": "Could not send. Try again in a moment.",
	"comments.note": "Comments appear after review, at the next deploy — not straight away.",
	"comments.unavailable": "Comment posting will be enabled after configuration.",

	"link.title": "Leaving this site",
	"link.note": "This link was left in a comment. It is not an address this blog has checked.",
	"link.cancel": "Cancel",
	"link.go": "Continue",

	"secret.mark": "Locked",
	"secret.locked": "This post is locked",
	"secret.passphrase": "Passphrase",
	"secret.open": "Unlock",
	"secret.working": "Unlocking",
	"secret.wrong": "That passphrase does not work.",

	"page.prev": "Previous",
	"page.next": "Next",

	"notFound.title": "No such page",
	"notFound.body": "The address may have changed, or the post was taken down.",
	"notFound.home": "Go to the index",
} as const;

export type UIKey = keyof typeof ui;

/** Named for what it does where it is called, which is stand in for a word. */
export const t = (key: UIKey): string => ui[key];

/** `<html lang>`, and what dates are formatted against. */
export const HTML_LANG = "en-US";
