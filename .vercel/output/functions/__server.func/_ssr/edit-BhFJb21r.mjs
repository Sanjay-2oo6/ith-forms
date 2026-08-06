import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime, r as useQueryClient } from "../_libs/react+tanstack__react-query.mjs";
import { o as supabase } from "./ith-brand-Df5jtyU6.mjs";
import { d as useBlocker, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { d as CSS, g as require_react_dom, i as closestCenter, l as useSensor, r as PointerSensor, t as DndContext, u as useSensors } from "../_libs/@dnd-kit/core+[...].mjs";
import { B as CircleAlert, H as ChevronDown, K as ArrowLeft, N as ExternalLink, O as GripVertical, T as LoaderCircle, U as Check, V as ChevronUp, _ as Plus, a as Trash2, c as Smartphone, j as Eye, m as Save, t as X, x as Monitor, y as Palette } from "../_libs/lucide-react.mjs";
import { o as uuidv4 } from "./validation-Cb9MIurp.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as AdminShell } from "./AdminShell-B0BieESN.mjs";
import { n as useConfirm } from "./ConfirmDialog-CpF41tKV.mjs";
import { t as Route } from "./edit-DXU5Z_Ba.mjs";
import { a as textareaCls, r as inputCls, t as Field } from "./ui-DnjfFzEa.mjs";
import { i as verticalListSortingStrategy, n as arrayMove, r as useSortable, t as SortableContext } from "../_libs/dnd-kit__sortable.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/edit-BhFJb21r.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_react_dom = /* @__PURE__ */ __toESM(require_react_dom());
var QUESTION_TYPES = [
	{
		type: "short_text",
		label: "Short Answer",
		category: "Text"
	},
	{
		type: "long_text",
		label: "Paragraph",
		category: "Text"
	},
	{
		type: "email",
		label: "Email",
		category: "Text"
	},
	{
		type: "phone",
		label: "Phone Number",
		category: "Text"
	},
	{
		type: "url",
		label: "URL",
		category: "Text"
	},
	{
		type: "radio",
		label: "Multiple Choice",
		category: "Choice"
	},
	{
		type: "checkbox",
		label: "Checkboxes",
		category: "Choice"
	},
	{
		type: "dropdown",
		label: "Dropdown",
		category: "Choice"
	},
	{
		type: "poll",
		label: "Poll",
		category: "Choice"
	},
	{
		type: "grid",
		label: "Multiple Choice Grid",
		category: "Choice"
	},
	{
		type: "date",
		label: "Date",
		category: "Date & Time"
	},
	{
		type: "time",
		label: "Time",
		category: "Date & Time"
	},
	{
		type: "rating",
		label: "Rating",
		category: "Scale"
	},
	{
		type: "file",
		label: "File Upload",
		category: "File"
	}
];
var QUESTION_TEMPLATES = [
	{
		id: "full_name",
		label: "Full Name",
		type: "name",
		placeholder: "e.g., Jane Doe"
	},
	{
		id: "first_name",
		label: "First Name",
		type: "short_text",
		placeholder: "e.g., Jane"
	},
	{
		id: "last_name",
		label: "Last Name",
		type: "short_text",
		placeholder: "e.g., Doe"
	},
	{
		id: "email",
		label: "Email Address",
		type: "email",
		placeholder: "you@example.com"
	},
	{
		id: "phone",
		label: "Phone Number",
		type: "phone",
		placeholder: "+91 98765 43210"
	},
	{
		id: "address",
		label: "Address",
		type: "address",
		placeholder: "Street, Area"
	},
	{
		id: "city",
		label: "City",
		type: "short_text",
		placeholder: "e.g., Hyderabad"
	},
	{
		id: "state",
		label: "State",
		type: "short_text",
		placeholder: "e.g., Telangana"
	},
	{
		id: "country",
		label: "Country",
		type: "short_text",
		placeholder: "e.g., India"
	},
	{
		id: "zip",
		label: "ZIP / Postal Code",
		type: "short_text",
		placeholder: "e.g., 500001",
		config: { maxLength: 10 }
	},
	{
		id: "linkedin",
		label: "LinkedIn",
		type: "url",
		placeholder: "www.linkedin.com/in/username"
	},
	{
		id: "portfolio",
		label: "Portfolio",
		type: "url",
		placeholder: "www.yourportfolio.com"
	},
	{
		id: "website",
		label: "Website",
		type: "url",
		placeholder: "www.example.com"
	},
	{
		id: "dob",
		label: "Date of Birth",
		type: "date"
	}
];
var CATEGORIES$1 = [...new Set(QUESTION_TYPES.map((q) => q.category))];
var CHOICE = [
	"dropdown",
	"radio",
	"checkbox",
	"poll"
];
var MemoQuestionCard = import_react.memo(QuestionCard, (prev, next) => {
	return prev.question === next.question && prev.isNew === next.isNew;
});
function QuestionCard({ question, onUpdate, onDelete, isNew, onMounted, confirm }) {
	const hasOptions = CHOICE.includes(question.type);
	const cfg = question.config ?? {};
	const setCfg = (patch) => onUpdate({ config: {
		...cfg,
		...patch
	} });
	const [expanded, setExpanded] = (0, import_react.useState)(!!isNew);
	const labelRef = (0, import_react.useRef)(null);
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
	(0, import_react.useEffect)(() => {
		if (isNew) {
			labelRef.current?.focus();
			labelRef.current?.select();
			onMounted?.();
		}
	}, []);
	async function changeType(nextType) {
		if (CHOICE.includes(question.type) && !CHOICE.includes(nextType) && (question.options?.length ?? 0) > 0) {
			if (!await confirm({
				title: "Change Question Type",
				message: "Switching to a non-choice type will remove this question's options. Continue?",
				confirmLabel: "Continue",
				variant: "default"
			})) return;
		}
		const patch = { type: nextType };
		if (CHOICE.includes(nextType)) {
			if (!question.options || question.options.length === 0) patch.options = [{
				label: "Option 1",
				value: "option_1"
			}, {
				label: "Option 2",
				value: "option_2"
			}];
		} else patch.options = [];
		if (nextType === "file" && cfg.accept === void 0) patch.config = {
			...cfg,
			accept: [
				".pdf",
				".docx",
				".jpg",
				".jpeg",
				".png"
			],
			maxFiles: 1
		};
		else if (nextType === "rating" && cfg.ratingMax === void 0) patch.config = {
			...cfg,
			ratingMax: 10
		};
		else if (nextType === "grid" && !cfg.rows) patch.config = {
			...cfg,
			rows: ["Row 1", "Row 2"],
			cols: ["Column 1", "Column 2"]
		};
		onUpdate(patch);
		setExpanded(true);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: setNodeRef,
		style: {
			transform: CSS.Transform.toString(transform),
			transition,
			opacity: isDragging ? .6 : 1
		},
		className: "rounded-lg border border-border/40 bg-background shadow-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3 px-3 py-2 bg-secondary/20 border-b border-border/30",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						...attributes,
						...listeners,
						className: "cursor-grab active:cursor-grabbing touch-none shrink-0 p-0.5 -m-0.5",
						title: "Drag to reorder question",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GripVertical, { className: "h-4 w-4 text-muted-foreground" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted-foreground flex-1",
						children: QUESTION_TYPES.find((t) => t.type === question.type)?.label ?? question.type
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted-foreground",
							children: "Required"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => onUpdate({ required: !question.required }),
							className: `relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${question.required ? "bg-primary" : "bg-secondary border border-border"}`,
							"aria-label": question.required ? "Mark as optional" : "Mark as required",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${question.required ? "translate-x-5" : "translate-x-1"}` })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setExpanded((v) => !v),
						className: "p-1 text-muted-foreground hover:text-foreground",
						"aria-label": expanded ? "Collapse question" : "Expand question",
						children: expanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "h-4 w-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onDelete,
						className: "p-1 hover:text-destructive transition-colors",
						"aria-label": "Delete question",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4" })
					})
				]
			}),
			expanded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-4 p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block text-sm font-semibold text-foreground mb-2",
							children: ["Question ", question.required && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-destructive",
								children: "*"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							ref: labelRef,
							value: question.label,
							onChange: (e) => onUpdate({ label: e.target.value }),
							className: "w-full text-base font-medium rounded-lg border border-input bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors",
							placeholder: "What would you like to ask?"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs font-medium text-muted-foreground mb-1.5",
							children: "Description (optional)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							value: question.description ?? "",
							onChange: (e) => onUpdate({ description: e.target.value || null }),
							className: "w-full text-sm rounded-lg border border-input bg-card px-3 py-2 outline-none focus:ring-1 focus:ring-ring resize-none",
							placeholder: "Add help text or additional context",
							rows: 2
						})] }),
						![
							"section_heading",
							"information_paragraph",
							"hidden",
							"yes_no",
							"consent",
							"rating",
							"linear_scale"
						].includes(question.type) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs font-medium text-muted-foreground mb-1.5",
							children: "Placeholder (optional)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: question.placeholder ?? "",
							onChange: (e) => onUpdate({ placeholder: e.target.value || null }),
							className: "w-full text-sm rounded-lg border border-input bg-card px-3 py-2 outline-none focus:ring-1 focus:ring-ring",
							placeholder: "e.g., John Doe"
						})] }),
						hasOptions && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OptionsEditor, {
							options: question.options,
							onChange: (opts) => onUpdate({ options: opts })
						}) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfigEditor, {
							type: question.type,
							cfg,
							setCfg
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-64 shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "block text-sm font-semibold text-foreground mb-3",
						children: "Question Type"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-1 max-h-96 overflow-y-auto pr-2",
						children: CATEGORIES$1.map((category) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-2",
								children: category
							}), QUESTION_TYPES.filter((t) => t.category === category).map((qType) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => changeType(qType.type),
								className: `w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${question.type === qType.type ? "bg-primary text-primary-foreground font-medium" : "hover:bg-secondary text-foreground"}`,
								children: qType.label
							}, qType.type))]
						}, category))
					})]
				})]
			}),
			!expanded && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-4 py-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium text-foreground truncate",
					children: question.label || /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground italic",
						children: "Untitled question"
					})
				})
			})
		]
	});
}
function OptionsEditor({ options, onChange }) {
	function addOption() {
		const existing = new Set(options.map((o) => o.value));
		let n = options.length + 1;
		while (existing.has(`option_${n}`)) n++;
		onChange([...options, {
			label: `Option ${n}`,
			value: `option_${n}`
		}]);
	}
	function updateOption(i, label) {
		onChange(options.map((o, idx) => idx === i ? {
			...o,
			label
		} : o));
	}
	function removeOption(i) {
		onChange(options.filter((_, idx) => idx !== i));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Options"
			}),
			options.map((opt, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: opt.label,
					onChange: (e) => updateOption(i, e.target.value),
					className: "flex-1 text-xs rounded border border-input bg-card px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => removeOption(i),
					className: "p-1 hover:text-destructive",
					"aria-label": "Remove option",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3 w-3" })
				})]
			}, i)),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: addOption,
				className: "flex items-center gap-1 text-xs text-primary hover:underline",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-3 w-3" }), " Add option"]
			})
		]
	});
}
function StringListEditor({ label, items, onChange, addLabel }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: label
			}),
			items.map((it, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: it,
					onChange: (e) => onChange(items.map((v, idx) => idx === i ? e.target.value : v)),
					className: "flex-1 text-xs rounded border border-input bg-card px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => onChange(items.filter((_, idx) => idx !== i)),
					className: "p-1 hover:text-destructive",
					"aria-label": `Remove ${label}`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3 w-3" })
				})]
			}, i)),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => onChange([...items, `${addLabel} ${items.length + 1}`]),
				className: "flex items-center gap-1 text-xs text-primary hover:underline",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-3 w-3" }),
					" Add ",
					addLabel.toLowerCase()
				]
			})
		]
	});
}
var MEDIA_IMAGE_EXTS = [
	".jpg",
	".jpeg",
	".png",
	".heic"
];
var MEDIA_VIDEO_EXTS = [".mp4", ".mov"];
function MediaEditor({ cfg, setCfg }) {
	const inputRef = (0, import_react.useRef)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const media = cfg.media;
	const mediaUrl = media ? media.pendingDataUrl ?? (media.path ? supabase.storage.from("form-assets").getPublicUrl(media.path).data.publicUrl : null) : null;
	async function upload(e) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		const lower = file.name.toLowerCase();
		const isImage = MEDIA_IMAGE_EXTS.some((x) => lower.endsWith(x));
		const isVideo = MEDIA_VIDEO_EXTS.some((x) => lower.endsWith(x));
		if (!isImage && !isVideo) {
			toast.error(`Unsupported media type. Images: ${MEDIA_IMAGE_EXTS.join(", ")} · Videos: ${MEDIA_VIDEO_EXTS.join(", ")}`);
			return;
		}
		if (file.size > 25 * 1024 * 1024) {
			toast.error("Media must be under 25 MB.");
			return;
		}
		setBusy(true);
		const reader = new FileReader();
		reader.onload = () => {
			setBusy(false);
			setCfg({ media: {
				kind: isImage ? "image" : "video",
				pendingDataUrl: String(reader.result),
				pendingName: file.name,
				pendingType: file.type,
				oldPath: media?.oldPath ?? media?.path
			} });
			toast.success("Media ready to save");
		};
		reader.onerror = () => {
			setBusy(false);
			toast.error("Media could not be read. Please try another file.");
		};
		reader.readAsDataURL(file);
	}
	function removeMedia() {
		setCfg({ media: void 0 });
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2 pt-2 border-t border-border/30",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Question media (optional — one image or video)"
			}),
			media && mediaUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2",
				children: [media.kind === "image" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: mediaUrl,
					alt: "Question media",
					className: "max-h-32 rounded-lg border border-border object-cover"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
					src: mediaUrl,
					controls: true,
					className: "max-h-32 rounded-lg border border-border"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => inputRef.current?.click(),
						disabled: busy,
						className: "px-2.5 py-1 rounded-md border border-border text-xs hover:bg-secondary disabled:opacity-60",
						children: "Replace"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: removeMedia,
						className: "px-2.5 py-1 rounded-md border border-border text-xs text-destructive hover:bg-destructive/10",
						children: "Remove"
					})]
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => inputRef.current?.click(),
				disabled: busy,
				className: "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:border-primary/60 hover:text-primary transition-colors disabled:opacity-60",
				children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3 w-3 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-3 w-3" }), " Add media"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: inputRef,
				type: "file",
				hidden: true,
				accept: [...MEDIA_IMAGE_EXTS, ...MEDIA_VIDEO_EXTS].join(","),
				onChange: upload
			})
		]
	});
}
function ConfigEditor({ type, cfg, setCfg }) {
	const FILE_EXTS = [
		".pdf",
		".docx",
		".jpg",
		".jpeg",
		".png"
	];
	const numInput = "w-24 text-xs rounded border border-input bg-card px-2 py-1 outline-none focus:ring-1 focus:ring-ring";
	const media = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaEditor, {
		cfg,
		setCfg
	});
	if (type === "file") {
		const accept = cfg.accept ?? FILE_EXTS;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "Accepted file types"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-2",
						children: FILE_EXTS.map((ext) => {
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex items-center gap-1.5 text-xs cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: accept.includes(ext),
									className: "accent-primary rounded",
									onChange: (e) => {
										const next = e.target.checked ? [...accept, ext] : accept.filter((a) => a !== ext);
										setCfg({ accept: next.length ? next : [ext] });
									}
								}), ext]
							}, ext);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "text-xs text-muted-foreground",
							children: "Max file size (MB)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "number",
							min: 1,
							max: 50,
							value: cfg.maxSizeMB ?? 10,
							onChange: (e) => setCfg({ maxSizeMB: Math.max(1, Math.min(50, parseInt(e.target.value) || 10)) }),
							className: numInput
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] text-muted-foreground",
						children: "Only one file may be uploaded per question."
					})
				]
			}), media]
		});
	}
	if (type === "rating") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				className: "text-xs text-muted-foreground",
				children: "Rating scale: 1 to"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				type: "number",
				min: 2,
				max: 10,
				value: cfg.ratingMax ?? 10,
				onChange: (e) => {
					setCfg({ ratingMax: Math.max(2, Math.min(10, parseInt(e.target.value) || 10)) });
				},
				className: numInput
			})]
		}), media]
	});
	if (type === "short_text" || type === "long_text") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: "text-xs text-muted-foreground",
					children: "Min length"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					min: 0,
					value: cfg.minLength ?? "",
					placeholder: "0",
					onChange: (e) => setCfg({ minLength: e.target.value === "" ? void 0 : Math.max(0, parseInt(e.target.value) || 0) }),
					className: numInput
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: "text-xs text-muted-foreground",
					children: "Max length"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					min: 1,
					value: cfg.maxLength ?? "",
					placeholder: "none",
					onChange: (e) => setCfg({ maxLength: e.target.value === "" ? void 0 : Math.max(1, parseInt(e.target.value) || 1) }),
					className: numInput
				})]
			})]
		}), media]
	});
	if (type === "checkbox") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: "text-xs text-muted-foreground",
					children: "Min selections"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					min: 0,
					value: cfg.minSelections ?? "",
					placeholder: "0",
					onChange: (e) => setCfg({ minSelections: e.target.value === "" ? void 0 : Math.max(0, parseInt(e.target.value) || 0) }),
					className: numInput
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: "text-xs text-muted-foreground",
					children: "Max selections"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					min: 1,
					value: cfg.maxSelections ?? "",
					placeholder: "none",
					onChange: (e) => setCfg({ maxSelections: e.target.value === "" ? void 0 : Math.max(1, parseInt(e.target.value) || 1) }),
					className: numInput
				})]
			})]
		}), media]
	});
	if (type === "grid") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StringListEditor, {
				label: "Rows",
				items: cfg.rows ?? [],
				addLabel: "Row",
				onChange: (rows) => setCfg({ rows })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StringListEditor, {
				label: "Columns",
				items: cfg.cols ?? [],
				addLabel: "Column",
				onChange: (cols) => setCfg({ cols })
			})]
		}), media]
	});
	return media;
}
var CATEGORIES = [...new Set(QUESTION_TYPES.map((q) => q.category))];
function SectionBlock({ section, questions, canDelete, onUpdate, onDelete, onAddQuestion, onAddTemplate, onUpdateQuestion, onDeleteQuestion, atLimit, lastAddedId, onClearLastAdded, isNew, onMounted, invalid, onReorderQuestions, confirm }) {
	const [pickerRect, setPickerRect] = (0, import_react.useState)(null);
	const qSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
	const containerRef = (0, import_react.useRef)(null);
	const titleRef = (0, import_react.useRef)(null);
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
	(0, import_react.useEffect)(() => {
		if (isNew) {
			containerRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "center"
			});
			titleRef.current?.focus();
			titleRef.current?.select();
			onMounted?.();
		}
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		id: `builder-section-${section.id}`,
		ref: (node) => {
			setNodeRef(node);
			containerRef.current = node;
		},
		style: {
			transform: CSS.Transform.toString(transform),
			transition,
			opacity: isDragging ? .6 : 1
		},
		className: `rounded-xl border bg-card overflow-hidden ${invalid ? "border-destructive ring-2 ring-destructive/40" : "border-border/60"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-secondary/30",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					...attributes,
					...listeners,
					className: "cursor-grab active:cursor-grabbing touch-none p-0.5 -m-0.5",
					title: "Drag to reorder section",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GripVertical, { className: "h-4 w-4 text-muted-foreground" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					ref: titleRef,
					value: section.title,
					onChange: (e) => onUpdate({ title: e.target.value }),
					className: "flex-1 font-semibold bg-transparent border-none outline-none text-sm",
					placeholder: "Section title"
				}),
				canDelete && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onDelete,
					className: "p-1 hover:text-destructive transition-colors",
					"aria-label": "Delete section",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4" })
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-4 space-y-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DndContext, {
					sensors: qSensors,
					collisionDetection: closestCenter,
					onDragEnd: (e) => {
						if (e.over && e.active.id !== e.over.id) onReorderQuestions(String(e.active.id), String(e.over.id));
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortableContext, {
						items: questions.map((q) => q.id),
						strategy: verticalListSortingStrategy,
						children: questions.map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemoQuestionCard, {
							question: q,
							onUpdate: (p) => onUpdateQuestion(q.id, p),
							onDelete: () => onDeleteQuestion(q.id),
							isNew: lastAddedId === q.id,
							onMounted: onClearLastAdded,
							confirm
						}, q.id))
					})
				}),
				!atLimit && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: (e) => {
							const rect = e.currentTarget.getBoundingClientRect();
							setPickerRect((prev) => prev ? null : rect);
						},
						className: "flex items-center gap-2 w-full py-2 px-3 rounded-md border border-dashed border-border/60 text-sm text-muted-foreground hover:border-primary/60 hover:text-primary transition-colors",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-4 w-4" }), " Add question"]
					}), pickerRect && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuestionTypePicker, {
						rect: pickerRect,
						onPick: (type) => {
							onAddQuestion(type);
							setPickerRect(null);
						},
						onPickTemplate: (tpl) => {
							onAddTemplate(tpl);
							setPickerRect(null);
						},
						onClose: () => setPickerRect(null)
					})]
				}),
				atLimit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground text-center py-2",
					children: "25 question limit reached"
				})
			]
		})]
	});
}
function QuestionTypePicker({ onPick, onPickTemplate, onClose, rect }) {
	const PICKER_W = 256;
	const PICKER_MAX_H = 320;
	const GAP = 8;
	const EDGE = 12;
	const style = rect ? (() => {
		const viewportH = window.innerHeight;
		const viewportW = window.innerWidth;
		const spaceBelow = viewportH - rect.bottom - GAP;
		const spaceAbove = rect.top - GAP;
		const openUpward = spaceBelow < PICKER_MAX_H && spaceAbove > spaceBelow;
		const maxHeight = Math.min(PICKER_MAX_H, Math.max(160, openUpward ? spaceAbove : spaceBelow));
		const desiredTop = openUpward ? rect.top - GAP - maxHeight : rect.bottom + GAP;
		return {
			position: "fixed",
			top: Math.max(EDGE, Math.min(desiredTop, viewportH - maxHeight - EDGE)),
			left: Math.max(EDGE, Math.min(rect.left, viewportW - PICKER_W - EDGE)),
			width: PICKER_W,
			maxHeight,
			zIndex: 50
		};
	})() : {
		position: "fixed",
		top: "50%",
		left: "50%",
		transform: "translate(-50%, -50%)",
		width: PICKER_W,
		maxHeight: PICKER_MAX_H,
		zIndex: 50
	};
	return (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-40",
		onClick: onClose
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "z-50 rounded-xl border border-border bg-card shadow-xl p-3 space-y-3 overflow-y-auto",
		style,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[10px] uppercase tracking-widest text-muted-foreground mb-1 px-1",
			children: "Templates"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-0.5",
			children: QUESTION_TEMPLATES.map((tpl) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => onPickTemplate(tpl),
				className: "w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-secondary transition-colors",
				children: tpl.label
			}, tpl.id))
		})] }), CATEGORIES.map((cat) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[10px] uppercase tracking-widest text-muted-foreground mb-1 px-1",
			children: cat
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-0.5",
			children: QUESTION_TYPES.filter((t) => t.category === cat).map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => onPick(t.type),
				className: "w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-secondary transition-colors",
				children: t.label
			}, t.type))
		})] }, cat))]
	})] }), document.body);
}
function BuilderTab({ sections, questions, onAddSection, onUpdateSection, onDeleteSection, onAddQuestion, onAddTemplate, onUpdateQuestion, onDeleteQuestion, questionCount, lastAddedId, onClearLastAdded, lastAddedSectionId, onClearLastAddedSection, invalidSectionIds, onReorderSections, onReorderQuestions, confirm }) {
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "max-w-2xl space-y-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted-foreground",
				children: [questionCount, "/25 questions · drag the grips to reorder"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => onAddSection(),
				className: "flex items-center gap-1.5 text-sm text-primary hover:underline",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-4 w-4" }), " Add section"]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DndContext, {
			sensors,
			collisionDetection: closestCenter,
			onDragEnd: (e) => {
				if (e.over && e.active.id !== e.over.id) onReorderSections(String(e.active.id), String(e.over.id));
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortableContext, {
				items: sections.map((s) => s.id),
				strategy: verticalListSortingStrategy,
				children: sections.map((sec) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionBlock, {
						section: sec,
						questions: questions.filter((q) => q.section_id === sec.id).sort((a, b) => a.position - b.position),
						canDelete: sections.length > 1,
						onUpdate: (p) => onUpdateSection(sec.id, p),
						onDelete: () => onDeleteSection(sec.id),
						onAddQuestion: (type) => onAddQuestion(sec.id, type),
						onAddTemplate: (tpl) => onAddTemplate(sec.id, tpl),
						onUpdateQuestion,
						onDeleteQuestion,
						atLimit: questionCount >= 25,
						lastAddedId,
						onClearLastAdded,
						isNew: sec.id === lastAddedSectionId,
						onMounted: onClearLastAddedSection,
						invalid: invalidSectionIds.includes(sec.id),
						onReorderQuestions: (a, b) => onReorderQuestions(sec.id, a, b),
						confirm
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => onAddSection(sec.position),
						className: "flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground hover:border-primary/60 hover:text-primary transition-colors",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-4 w-4" }), " Add section"]
					})]
				}, sec.id))
			})
		})]
	});
}
function toLocalDatetimeInput(iso) {
	if (!iso) return "";
	const d = new Date(iso);
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function SettingsTab({ form, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "max-w-xl space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-border/60 bg-card p-5 space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold",
						children: "Schedule & Limits"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Opens at",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "datetime-local",
							value: toLocalDatetimeInput(form.opens_at),
							onChange: (e) => onChange({ opens_at: e.target.value ? new Date(e.target.value).toISOString() : null }),
							className: inputCls + " h-9"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Closes at",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "datetime-local",
							value: toLocalDatetimeInput(form.closes_at),
							onChange: (e) => onChange({ closes_at: e.target.value ? new Date(e.target.value).toISOString() : null }),
							className: inputCls + " h-9"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Max responses",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "number",
							min: 1,
							value: form.max_responses ?? "",
							onChange: (e) => onChange({ max_responses: e.target.value ? parseInt(e.target.value) : null }),
							placeholder: "Unlimited",
							className: inputCls + " h-9"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: form.allow_anonymous,
							onChange: (e) => onChange({ allow_anonymous: e.target.checked })
						}), "Allow anonymous responses"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-border/60 bg-card p-5 space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold",
						children: "Confirmation"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Thank-you title",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: form.confirmation_title ?? "",
							onChange: (e) => onChange({ confirmation_title: e.target.value || null }),
							placeholder: "Thank you!",
							className: inputCls + " h-9"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Thank-you message",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							value: form.confirmation_message ?? "",
							onChange: (e) => onChange({ confirmation_message: e.target.value || null }),
							rows: 3,
							placeholder: "Your response has been received.",
							className: textareaCls
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-border/60 bg-card p-5 space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-semibold",
					children: "Consent & Notice"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Consent / privacy notice text",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						value: form.consent_text ?? "",
						onChange: (e) => onChange({ consent_text: e.target.value || null }),
						rows: 3,
						placeholder: "By submitting this form, you agree to…",
						className: textareaCls
					})
				})]
			})
		]
	});
}
function SaveIndicator({ state }) {
	if (state === "saving") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "flex items-center gap-1 text-xs text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3 w-3 animate-spin" }), "Saving..."]
	});
	if (state === "dirty") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "flex items-center gap-1 text-xs text-amber-500",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-3 w-3" }), "Unsaved changes"]
	});
	if (state === "error") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "flex items-center gap-1 text-xs text-destructive",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-3 w-3" }), "Save failed"]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "flex items-center gap-1 text-xs text-green-400",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-3 w-3" }), "Saved"]
	});
}
function stripPendingMedia$1(draft) {
	return {
		...draft,
		questions: draft.questions.map((q) => {
			const media = q.config?.media;
			if (!media?.pendingDataUrl) return q;
			return {
				...q,
				config: {
					...q.config,
					media: media.oldPath || media.path ? {
						kind: media.kind,
						path: media.path ?? media.oldPath
					} : void 0
				}
			};
		})
	};
}
/**
* Live form preview: renders the real public form route in an iframe, with a
* same-tab draft so unsaved builder edits are visible without persistence.
*/
function PreviewModal({ slug, draft, onClose }) {
	const [device, setDevice] = (0, import_react.useState)("mobile");
	const draftKey = (0, import_react.useMemo)(() => `ith-preview-${draft.form.id}-${draft.createdAt}`, [draft.form.id, draft.createdAt]);
	const src = `/forms/${slug}?preview=1&draft=${encodeURIComponent(draftKey)}`;
	(0, import_react.useEffect)(() => {
		try {
			sessionStorage.setItem(draftKey, JSON.stringify(draft));
		} catch {
			try {
				sessionStorage.setItem(draftKey, JSON.stringify(stripPendingMedia$1(draft)));
				toast.info("Unsaved media files are too large for the live preview — showing the last saved media instead.");
			} catch {
				sessionStorage.removeItem(draftKey);
				toast.info("This draft is too large for the live preview — showing the last saved version instead.");
			}
		}
		return () => sessionStorage.removeItem(draftKey);
	}, [draft, draftKey]);
	return (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-[1000] overflow-y-auto bg-black/70 backdrop-blur-sm",
		onClick: onClose,
		role: "dialog",
		"aria-modal": "true",
		"aria-label": "Form preview",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-h-full flex items-start justify-center px-3 py-5 sm:p-6",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full max-w-[1120px] flex flex-col items-center",
				onClick: (e) => e.stopPropagation(),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex max-w-full flex-wrap items-center justify-center gap-2 mb-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setDevice("mobile"),
								className: `flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors ${device === "mobile" ? "border-primary bg-card text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "h-4 w-4" }), " Mobile"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setDevice("desktop"),
								className: `flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors ${device === "desktop" ? "border-primary bg-card text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Monitor, { className: "h-4 w-4" }), " Desktop"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: src,
								target: "_blank",
								rel: "noopener noreferrer",
								className: "flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-sm text-muted-foreground hover:text-foreground transition-colors",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "h-4 w-4" }), " Open in tab"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: onClose,
								className: "flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-sm text-muted-foreground hover:text-destructive transition-colors",
								"aria-label": "Close preview",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-4 w-4" }), " Close"]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "bg-card border-4 border-border shadow-2xl overflow-hidden transition-all duration-300",
						style: device === "mobile" ? {
							width: "min(390px, calc(100vw - 1.5rem))",
							height: "min(844px, calc(100vh - 8.5rem))",
							minHeight: 420,
							borderRadius: "2rem"
						} : {
							width: "min(1100px, calc(100vw - 1.5rem))",
							height: "min(820px, calc(100vh - 8.5rem))",
							minHeight: 420,
							borderRadius: "0.75rem"
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
							src,
							title: "Form preview",
							className: "w-full h-full border-0 bg-background"
						}, src)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-center text-xs text-white/80",
						children: "Preview mode - submissions are disabled. Unsaved edits are shown here without saving."
					})
				]
			})
		})
	}), document.body);
}
var UNSAVED_MESSAGE = "You have unsaved changes. Leave without saving?";
function FormEditor() {
	const { confirm } = useConfirm();
	const queryClient = useQueryClient();
	const { formId } = Route.useParams();
	const [form, setForm] = (0, import_react.useState)(null);
	const [sections, setSections] = (0, import_react.useState)([]);
	const [questions, setQuestions] = (0, import_react.useState)([]);
	const [savedQuestions, setSavedQuestions] = (0, import_react.useState)([]);
	const [saveState, setSaveState] = (0, import_react.useState)("idle");
	const [activeTab, setActiveTab] = (0, import_react.useState)("builder");
	const [lastAddedId, setLastAddedId] = (0, import_react.useState)(null);
	const [lastAddedSectionId, setLastAddedSectionId] = (0, import_react.useState)(null);
	const [invalidSectionIds, setInvalidSectionIds] = (0, import_react.useState)([]);
	const [hasUnsavedChanges, setHasUnsavedChanges] = (0, import_react.useState)(false);
	const [showPreview, setShowPreview] = (0, import_react.useState)(false);
	useBlocker({
		disabled: !hasUnsavedChanges && saveState !== "saving",
		enableBeforeUnload: () => hasUnsavedChanges || saveState === "saving",
		shouldBlockFn: ({ current, next }) => {
			if (current.pathname === next.pathname) return false;
			return !window.confirm(UNSAVED_MESSAGE);
		}
	});
	(0, import_react.useEffect)(() => {
		const handleBeforeUnload = (e) => {
			if (!hasUnsavedChanges && saveState !== "saving") return;
			e.preventDefault();
			e.returnValue = UNSAVED_MESSAGE;
			return UNSAVED_MESSAGE;
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [saveState, hasUnsavedChanges]);
	(0, import_react.useEffect)(() => {
		load();
	}, [formId]);
	const previewDraft = (0, import_react.useMemo)(() => {
		if (!form) return null;
		return {
			form,
			sections: normalizeSections(sections),
			questions: normalizeQuestions(questions, normalizeSections(sections)),
			createdAt: Date.now()
		};
	}, [
		form,
		sections,
		questions
	]);
	async function load() {
		const [fRes, sRes, qRes] = await Promise.all([
			supabase.from("forms").select("*").eq("id", formId).single(),
			supabase.from("form_sections").select("*").eq("form_id", formId).order("position"),
			supabase.from("form_questions").select("*").eq("form_id", formId).order("position")
		]);
		if (fRes.error) {
			toast.error(fRes.error.message);
			return;
		}
		const loadedSections = (sRes.data ?? []).sort((a, b) => a.position - b.position);
		const loadedQuestions = (qRes.data ?? []).sort((a, b) => a.position - b.position);
		setForm(fRes.data);
		setSections(loadedSections);
		setQuestions(loadedQuestions);
		setSavedQuestions(loadedQuestions);
		setHasUnsavedChanges(false);
		setSaveState("saved");
	}
	function markDirty() {
		setHasUnsavedChanges(true);
		setSaveState("dirty");
	}
	function updateForm(patch) {
		setForm((f) => f ? {
			...f,
			...patch
		} : f);
		markDirty();
	}
	async function uploadPendingMedia(inputQuestions) {
		const uploadedPaths = [];
		const updated = [];
		for (const question of inputQuestions) {
			const media = question.config?.media;
			if (!media?.pendingDataUrl) {
				updated.push(question);
				continue;
			}
			const blob = await (await fetch(media.pendingDataUrl)).blob();
			const safe = (media.pendingName ?? "media").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150);
			const path = `question-media/${question.id}/${Date.now()}-${safe}`;
			const file = new File([blob], safe, { type: media.pendingType || blob.type });
			const { error } = await supabase.storage.from("form-assets").upload(path, file, { upsert: true });
			if (error) throw new Error(`Media upload failed for "${question.label || "Untitled question"}": ${error.message}`);
			uploadedPaths.push(path);
			updated.push({
				...question,
				config: {
					...question.config,
					media: {
						path,
						kind: media.kind,
						oldPath: media.oldPath
					}
				}
			});
		}
		return {
			questions: updated,
			uploadedPaths
		};
	}
	async function saveAll() {
		if (!form || saveState === "saving") return false;
		if (!form.title.trim()) {
			toast.error("Form title is required");
			return false;
		}
		if (questions.length > 25) {
			toast.error("Form has reached the 25 question limit");
			return false;
		}
		const normalizedSections = normalizeSections(sections);
		const normalizedQuestions = normalizeQuestions(questions, normalizedSections);
		const emptyIds = normalizedSections.filter((sec) => !normalizedQuestions.some((q) => q.section_id === sec.id)).map((sec) => sec.id);
		if (emptyIds.length > 0) {
			setInvalidSectionIds(emptyIds);
			toast.error("Each section must contain at least one question.");
			document.getElementById(`builder-section-${emptyIds[0]}`)?.scrollIntoView({
				behavior: "smooth",
				block: "center"
			});
			return false;
		}
		setInvalidSectionIds([]);
		setSaveState("saving");
		const uploadedPaths = [];
		try {
			const mediaResult = await uploadPendingMedia(normalizedQuestions);
			uploadedPaths.push(...mediaResult.uploadedPaths);
			const questionsForSave = mediaResult.questions.map(stripPendingMedia);
			const { data, error } = await supabase.rpc("save_form_builder", {
				p_form_id: form.id,
				p_form: buildFormPayload(form),
				p_sections: normalizedSections,
				p_questions: questionsForSave
			});
			if (error) throw new Error(error.message);
			if (!data?.ok) throw new Error("Save did not complete");
			const oldMediaPaths = mediaPaths(savedQuestions);
			const currentMediaPaths = mediaPaths(questionsForSave);
			const replacedOrRemoved = [...oldMediaPaths].filter((path) => !currentMediaPaths.has(path));
			if (replacedOrRemoved.length > 0) await supabase.storage.from("form-assets").remove(replacedOrRemoved);
			setSections(normalizedSections);
			setQuestions(questionsForSave);
			setSavedQuestions(questionsForSave);
			setHasUnsavedChanges(false);
			setSaveState("saved");
			toast.success("Saved successfully");
			return true;
		} catch (err) {
			if (uploadedPaths.length > 0) await supabase.storage.from("form-assets").remove(uploadedPaths);
			console.error("[builder-save] failed:", err);
			setSaveState("error");
			await queryClient.invalidateQueries({ queryKey: ["form-meta", form.id] });
			await queryClient.invalidateQueries({ queryKey: ["form-questions", form.id] });
			await queryClient.invalidateQueries({ queryKey: ["form-sections", form.id] });
			toast.error(err instanceof Error ? err.message : "Save failed. Reloading...");
			return false;
		}
	}
	async function publish() {
		if (!form) return;
		if (hasUnsavedChanges) {
			toast.message("Saving changes before publishing...");
			if (!await saveAll()) return;
		}
		const emptyIds = sections.filter((sec) => !questions.some((q) => q.section_id === sec.id)).map((sec) => sec.id);
		if (emptyIds.length > 0) {
			setInvalidSectionIds(emptyIds);
			toast.error("Each section must contain at least one question.");
			document.getElementById(`builder-section-${emptyIds[0]}`)?.scrollIntoView({
				behavior: "smooth",
				block: "center"
			});
			return;
		}
		if (sections.length === 0) {
			toast.error("Add at least one section before publishing");
			return;
		}
		if (questions.filter((q) => ![
			"section_heading",
			"information_paragraph",
			"hidden"
		].includes(q.type)).length === 0) {
			toast.error("Add at least one question before publishing");
			return;
		}
		setSaveState("saving");
		const patch = { status: "published" };
		if (!form.published_at) patch.published_at = (/* @__PURE__ */ new Date()).toISOString();
		const { error } = await supabase.from("forms").update(patch).eq("id", form.id);
		if (error) {
			setSaveState("error");
			toast.error(error.message);
			return;
		}
		setForm({
			...form,
			...patch
		});
		setSaveState("saved");
		await supabase.from("audit_logs").insert({
			action: "form.published",
			entity: "form",
			entity_id: form.id,
			metadata: { title: form.title }
		});
		toast.success("Form published! Share the link below.");
	}
	async function unpublish() {
		if (!form) return;
		const { error } = await supabase.from("forms").update({
			status: "draft",
			published_at: null
		}).eq("id", form.id);
		if (error) {
			toast.error(error.message);
			return;
		}
		setForm({
			...form,
			status: "draft",
			published_at: null
		});
		await supabase.from("audit_logs").insert({
			action: "form.unpublished",
			entity: "form",
			entity_id: form.id,
			metadata: { title: form.title }
		});
		toast.success("Form unpublished");
	}
	function addSection(afterPosition) {
		const ordered = normalizeSections(sections);
		const insertPos = afterPosition !== void 0 ? afterPosition + 1 : ordered.length;
		const newSection = {
			id: uuidv4(),
			title: `Section ${insertPos + 1}`,
			description: null,
			position: insertPos
		};
		const next = [...ordered];
		next.splice(insertPos, 0, newSection);
		setSections(renumberSections(next));
		setLastAddedSectionId(newSection.id);
		markDirty();
	}
	function updateSection(id, patch) {
		setSections((s) => s.map((sec) => sec.id === id ? {
			...sec,
			...patch
		} : sec));
		markDirty();
	}
	async function deleteSection(id) {
		if (sections.length <= 1) {
			toast.error("At least one section must remain");
			return;
		}
		if (!await confirm({
			title: "Delete Section",
			message: "Delete this section? Its questions will be moved to the first remaining section.",
			confirmLabel: "Delete",
			variant: "destructive"
		})) return;
		const remaining = sections.filter((sec) => sec.id !== id);
		const firstRemaining = remaining[0];
		setSections(renumberSections(remaining));
		if (firstRemaining) setQuestions((q) => q.map((qn) => qn.section_id === id ? {
			...qn,
			section_id: firstRemaining.id
		} : qn));
		markDirty();
	}
	function addQuestion(sectionId, type, overrides) {
		if (questions.length >= 25) {
			toast.error("Form has reached the 25 question limit");
			return;
		}
		const sectionQs = questions.filter((q) => q.section_id === sectionId);
		const defaultLabels = {
			email: "Email Address",
			phone: "Phone Number",
			name: "Full Name",
			address: "Address",
			organization: "Organization",
			url: "Website URL",
			date: "Date",
			time: "Time",
			datetime: "Date and Time",
			number: "Number",
			file: "File Upload",
			document: "Document Upload",
			image: "Image Upload"
		};
		const defaultOptions = [
			"dropdown",
			"radio",
			"checkbox",
			"poll"
		].includes(type) ? [{
			label: "Option 1",
			value: "option_1"
		}, {
			label: "Option 2",
			value: "option_2"
		}] : [];
		const baseConfig = type === "file" ? {
			accept: [
				".pdf",
				".docx",
				".jpg",
				".jpeg",
				".png"
			],
			maxFiles: 1
		} : type === "rating" ? { ratingMax: 10 } : type === "grid" ? {
			rows: ["Row 1", "Row 2"],
			cols: ["Column 1", "Column 2"]
		} : {};
		const newQuestion = {
			id: uuidv4(),
			section_id: sectionId,
			type,
			label: overrides?.label ?? (defaultLabels[type] || ""),
			description: null,
			placeholder: overrides?.placeholder ?? null,
			required: false,
			default_value: null,
			options: defaultOptions,
			config: {
				...baseConfig,
				...overrides?.config ?? {}
			},
			position: sectionQs.length
		};
		setQuestions((q) => [...q, newQuestion]);
		setLastAddedId(newQuestion.id);
		setInvalidSectionIds((ids) => ids.filter((id) => id !== sectionId));
		markDirty();
	}
	function addTemplateQuestion(sectionId, tpl) {
		return addQuestion(sectionId, tpl.type, {
			label: tpl.label,
			placeholder: tpl.placeholder ?? null,
			config: tpl.config ?? void 0
		});
	}
	function updateQuestion(id, patch) {
		setQuestions((q) => q.map((qn) => qn.id === id ? {
			...qn,
			...patch
		} : qn));
		markDirty();
	}
	async function deleteQuestion(id) {
		if (!await confirm({
			title: "Delete Question",
			message: "Are you sure you want to delete this question?",
			confirmLabel: "Delete",
			variant: "destructive"
		})) return;
		setQuestions((q) => q.filter((qn) => qn.id !== id));
		markDirty();
	}
	function reorderSections(activeId, overId) {
		const ordered = normalizeSections(sections);
		const oldIndex = ordered.findIndex((s) => s.id === activeId);
		const newIndex = ordered.findIndex((s) => s.id === overId);
		if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
		setSections(renumberSections(arrayMove(ordered, oldIndex, newIndex)));
		markDirty();
	}
	function reorderQuestions(sectionId, activeId, overId) {
		const sectionQs = questions.filter((q) => q.section_id === sectionId).sort((a, b) => a.position - b.position);
		const oldIndex = sectionQs.findIndex((q) => q.id === activeId);
		const newIndex = sectionQs.findIndex((q) => q.id === overId);
		if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
		const reordered = arrayMove(sectionQs, oldIndex, newIndex).map((q, i) => ({
			...q,
			position: i
		}));
		const byId = new Map(reordered.map((q) => [q.id, q]));
		setQuestions((prev) => prev.map((q) => byId.get(q.id) ?? q));
		markDirty();
	}
	if (!form) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "p-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "animate-spin" })
	}) });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AdminShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sticky top-0 z-20 flex items-center gap-4 px-6 py-4 border-b border-border/60 bg-card/95 backdrop-blur",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/forms",
					className: "flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:bg-secondary transition-colors shrink-0",
					"aria-label": "Back to forms",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "h-4 w-4" }), " Forms"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: form.title,
						onChange: (e) => updateForm({ title: e.target.value }),
						className: "text-xl font-bold bg-transparent border-none outline-none w-full",
						placeholder: "Form title"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted-foreground",
						children: ["/forms/", form.slug]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SaveIndicator, { state: saveState }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: saveAll,
					disabled: saveState === "saving" || !hasUnsavedChanges,
					className: "flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60",
					children: [saveState === "saving" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "h-3.5 w-3.5" }), saveState === "saving" ? "Saving..." : "Save"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: `text-xs px-2 py-0.5 rounded-full font-medium ${form.status === "published" ? "bg-green-500/20 text-green-400" : "bg-secondary text-secondary-foreground"}`,
					children: form.status
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => setShowPreview(true),
					className: "flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-secondary",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "h-3.5 w-3.5" }), " Preview"]
				}),
				form.status === "published" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: `/forms/${form.slug}.html`,
					target: "_blank",
					rel: "noopener noreferrer",
					className: "flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-secondary",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "h-3.5 w-3.5" }), " View"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/forms/$formId/theme",
					params: { formId },
					className: "flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-secondary",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, { className: "h-3.5 w-3.5" }), " Theme"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/forms/$formId/responses",
					params: { formId },
					className: "flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-secondary",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "h-3.5 w-3.5" }), " Responses"]
				}),
				form.status === "published" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: unpublish,
					className: "px-4 py-1.5 rounded-md border border-border text-sm hover:bg-secondary",
					children: "Unpublish"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: publish,
					disabled: saveState === "saving",
					className: "px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60",
					children: "Publish"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "sticky top-[57px] z-20 flex border-b border-border/60 px-6 bg-background",
			children: ["builder", "settings"].map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => setActiveTab(tab),
				className: `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`,
				children: tab
			}, tab))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "p-6",
			children: activeTab === "builder" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BuilderTab, {
				sections,
				questions,
				onAddSection: addSection,
				onUpdateSection: updateSection,
				onDeleteSection: deleteSection,
				onAddQuestion: addQuestion,
				onAddTemplate: addTemplateQuestion,
				onUpdateQuestion: updateQuestion,
				onDeleteQuestion: deleteQuestion,
				questionCount: questions.length,
				lastAddedId,
				onClearLastAdded: () => setLastAddedId(null),
				lastAddedSectionId,
				onClearLastAddedSection: () => setLastAddedSectionId(null),
				invalidSectionIds,
				onReorderSections: reorderSections,
				onReorderQuestions: reorderQuestions,
				confirm
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsTab, {
				form,
				onChange: updateForm
			})
		})
	] }), showPreview && previewDraft && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewModal, {
		slug: form.slug,
		draft: previewDraft,
		onClose: () => setShowPreview(false)
	})] });
}
function renumberSections(list) {
	return list.map((s, i) => ({
		...s,
		position: i,
		title: /^Section \d+$/.test(s.title) ? `Section ${i + 1}` : s.title
	}));
}
function normalizeSections(list) {
	return renumberSections([...list].sort((a, b) => a.position - b.position));
}
function normalizeQuestions(list, sections) {
	const sectionIds = new Set(sections.map((s) => s.id));
	const firstSectionId = sections[0]?.id;
	const grouped = /* @__PURE__ */ new Map();
	for (const question of list) {
		const sectionId = sectionIds.has(question.section_id) ? question.section_id : firstSectionId;
		if (!sectionId) continue;
		const nextQuestion = {
			...question,
			section_id: sectionId
		};
		grouped.set(sectionId, [...grouped.get(sectionId) ?? [], nextQuestion]);
	}
	return sections.flatMap((section) => (grouped.get(section.id) ?? []).sort((a, b) => a.position - b.position).map((question, index) => ({
		...question,
		position: index
	})));
}
function buildFormPayload(form) {
	return {
		title: form.title,
		description: form.description,
		opens_at: form.opens_at,
		closes_at: form.closes_at,
		max_responses: form.max_responses,
		allow_anonymous: form.allow_anonymous,
		consent_text: form.consent_text,
		confirmation_title: form.confirmation_title,
		confirmation_message: form.confirmation_message
	};
}
function stripPendingMedia(question) {
	const media = question.config?.media;
	if (!media) return question;
	const config = { ...question.config };
	config.media = media.path ? {
		path: media.path,
		kind: media.kind
	} : void 0;
	return {
		...question,
		config
	};
}
function mediaPaths(inputQuestions) {
	const paths = /* @__PURE__ */ new Set();
	for (const question of inputQuestions) {
		const path = question.config?.media?.path;
		if (path) paths.add(path);
	}
	return paths;
}
//#endregion
export { FormEditor as component };
