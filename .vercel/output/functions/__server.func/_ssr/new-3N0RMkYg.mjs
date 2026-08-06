import { o as __toESM } from "../_runtime.mjs";
import { i as require_react } from "../_libs/dnd-kit__accessibility+react.mjs";
import { i as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { c as useAppSettings, o as supabase } from "./ith-brand-DcxNWcJj.mjs";
import { y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { A as FileText, s as Sparkles } from "../_libs/lucide-react.mjs";
import { i as fieldErrors, n as FormCreateSchema } from "./validation-Cb9MIurp.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as AdminShell } from "./AdminShell-CDlfLDsd.mjs";
import { a as textareaCls, i as selectCls, n as LoadingButton, r as inputCls, t as Field } from "./ui-DnjfFzEa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/new-3N0RMkYg.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FORM_TEMPLATES = [
	{
		id: "event-rsvp",
		name: "Event RSVP",
		description: "Collect attendee information and meal preferences for events",
		category: "event",
		icon: "calendar",
		sections: [{
			title: "Attendee Information",
			description: "Tell us about yourself",
			questions: [
				{
					type: "short_text",
					label: "Full Name",
					required: true,
					placeholder: "Jane Smith"
				},
				{
					type: "email",
					label: "Email Address",
					required: true,
					placeholder: "jane@example.com"
				},
				{
					type: "phone",
					label: "Phone Number",
					required: false,
					placeholder: "+1234567890"
				}
			]
		}, {
			title: "Event Details",
			description: "Confirm your attendance",
			questions: [
				{
					type: "yes_no",
					label: "Will you be attending?",
					required: true
				},
				{
					type: "dropdown",
					label: "Meal Preference",
					required: false,
					options: [
						{
							label: "Chicken",
							value: "chicken"
						},
						{
							label: "Vegetarian",
							value: "vegetarian"
						},
						{
							label: "Vegan",
							value: "vegan"
						},
						{
							label: "Gluten-free",
							value: "gluten_free"
						}
					]
				},
				{
					type: "checkbox",
					label: "Dietary Restrictions",
					required: false,
					options: [
						{
							label: "Nut allergy",
							value: "nut_allergy"
						},
						{
							label: "Dairy-free",
							value: "dairy_free"
						},
						{
							label: "Shellfish allergy",
							value: "shellfish_allergy"
						},
						{
							label: "Other",
							value: "other"
						}
					]
				},
				{
					type: "long_text",
					label: "Special Requests or Comments",
					required: false,
					placeholder: "Any additional information we should know?"
				}
			]
		}]
	},
	{
		id: "customer-feedback",
		name: "Customer Feedback",
		description: "Gather customer satisfaction ratings and comments",
		category: "feedback",
		icon: "message-square",
		sections: [{
			title: "Your Experience",
			description: "Help us improve our service",
			questions: [
				{
					type: "rating",
					label: "Overall Satisfaction",
					description: "Rate your experience from 1 to 5 stars",
					required: true
				},
				{
					type: "linear_scale",
					label: "Likelihood to Recommend",
					description: "How likely are you to recommend us? (1-10)",
					required: true
				},
				{
					type: "checkbox",
					label: "What did you like?",
					required: false,
					options: [
						{
							label: "Product quality",
							value: "quality"
						},
						{
							label: "Customer service",
							value: "service"
						},
						{
							label: "Pricing",
							value: "pricing"
						},
						{
							label: "Fast delivery",
							value: "delivery"
						},
						{
							label: "Easy to use",
							value: "usability"
						}
					]
				},
				{
					type: "long_text",
					label: "Additional Comments",
					required: false,
					placeholder: "Tell us more about your experience..."
				}
			]
		}]
	},
	{
		id: "contact-form",
		name: "Contact Form",
		description: "Simple contact form for inquiries and support",
		category: "feedback",
		icon: "mail",
		sections: [{
			title: "Contact Information",
			questions: [
				{
					type: "short_text",
					label: "Name",
					required: true
				},
				{
					type: "email",
					label: "Email",
					required: true
				},
				{
					type: "phone",
					label: "Phone (optional)",
					required: false
				}
			]
		}, {
			title: "Your Message",
			questions: [{
				type: "dropdown",
				label: "Subject",
				required: true,
				options: [
					{
						label: "General Inquiry",
						value: "general"
					},
					{
						label: "Technical Support",
						value: "support"
					},
					{
						label: "Sales",
						value: "sales"
					},
					{
						label: "Feedback",
						value: "feedback"
					},
					{
						label: "Other",
						value: "other"
					}
				]
			}, {
				type: "long_text",
				label: "Message",
				required: true,
				placeholder: "How can we help you?"
			}]
		}]
	},
	{
		id: "job-application",
		name: "Job Application",
		description: "Collect applicant information and resume uploads",
		category: "application",
		icon: "briefcase",
		sections: [
			{
				title: "Personal Information",
				questions: [
					{
						type: "short_text",
						label: "Full Name",
						required: true
					},
					{
						type: "email",
						label: "Email Address",
						required: true
					},
					{
						type: "phone",
						label: "Phone Number",
						required: true
					},
					{
						type: "url",
						label: "LinkedIn Profile (optional)",
						required: false,
						placeholder: "https://linkedin.com/in/yourprofile"
					}
				]
			},
			{
				title: "Position Details",
				questions: [{
					type: "dropdown",
					label: "Position Applying For",
					required: true,
					options: [
						{
							label: "Software Engineer",
							value: "software_engineer"
						},
						{
							label: "Product Manager",
							value: "product_manager"
						},
						{
							label: "Designer",
							value: "designer"
						},
						{
							label: "Marketing Specialist",
							value: "marketing"
						},
						{
							label: "Other",
							value: "other"
						}
					]
				}, {
					type: "radio",
					label: "Employment Type",
					required: true,
					options: [
						{
							label: "Full-time",
							value: "full_time"
						},
						{
							label: "Part-time",
							value: "part_time"
						},
						{
							label: "Contract",
							value: "contract"
						},
						{
							label: "Internship",
							value: "internship"
						}
					]
				}]
			},
			{
				title: "Experience",
				questions: [
					{
						type: "number",
						label: "Years of Experience",
						required: true
					},
					{
						type: "long_text",
						label: "Why are you a good fit?",
						required: true,
						placeholder: "Tell us about your relevant experience and skills..."
					},
					{
						type: "file",
						label: "Resume / CV",
						description: "PDF or Word document (max 10MB)",
						required: true
					},
					{
						type: "file",
						label: "Cover Letter (optional)",
						required: false
					}
				]
			}
		]
	},
	{
		id: "course-registration",
		name: "Course Registration",
		description: "Student enrollment form with course selection",
		category: "registration",
		icon: "graduation-cap",
		sections: [{
			title: "Student Information",
			questions: [
				{
					type: "short_text",
					label: "Student Name",
					required: true
				},
				{
					type: "email",
					label: "Email Address",
					required: true
				},
				{
					type: "short_text",
					label: "Student ID (if applicable)",
					required: false
				}
			]
		}, {
			title: "Course Selection",
			questions: [
				{
					type: "dropdown",
					label: "Course",
					required: true,
					options: [
						{
							label: "Introduction to Programming",
							value: "intro_programming"
						},
						{
							label: "Web Development",
							value: "web_dev"
						},
						{
							label: "Data Science Fundamentals",
							value: "data_science"
						},
						{
							label: "Machine Learning",
							value: "machine_learning"
						},
						{
							label: "Mobile App Development",
							value: "mobile_dev"
						}
					]
				},
				{
					type: "radio",
					label: "Session",
					required: true,
					options: [
						{
							label: "Morning (9 AM - 12 PM)",
							value: "morning"
						},
						{
							label: "Afternoon (1 PM - 4 PM)",
							value: "afternoon"
						},
						{
							label: "Evening (6 PM - 9 PM)",
							value: "evening"
						}
					]
				},
				{
					type: "yes_no",
					label: "Have you taken courses with us before?",
					required: true
				}
			]
		}]
	},
	{
		id: "survey-satisfaction",
		name: "Satisfaction Survey",
		description: "Comprehensive satisfaction and experience survey",
		category: "survey",
		icon: "clipboard-list",
		sections: [{
			title: "Overall Experience",
			questions: [{
				type: "rating",
				label: "Overall Satisfaction",
				required: true
			}, {
				type: "linear_scale",
				label: "Net Promoter Score",
				description: "On a scale of 1-10, how likely are you to recommend us?",
				required: true
			}]
		}, {
			title: "Detailed Feedback",
			questions: [
				{
					type: "radio",
					label: "How often do you use our service?",
					required: true,
					options: [
						{
							label: "Daily",
							value: "daily"
						},
						{
							label: "Weekly",
							value: "weekly"
						},
						{
							label: "Monthly",
							value: "monthly"
						},
						{
							label: "Rarely",
							value: "rarely"
						}
					]
				},
				{
					type: "checkbox",
					label: "Which features do you use most?",
					required: false,
					options: [
						{
							label: "Feature A",
							value: "feature_a"
						},
						{
							label: "Feature B",
							value: "feature_b"
						},
						{
							label: "Feature C",
							value: "feature_c"
						},
						{
							label: "Feature D",
							value: "feature_d"
						}
					]
				},
				{
					type: "long_text",
					label: "What can we improve?",
					required: false,
					placeholder: "Your suggestions help us get better..."
				}
			]
		}]
	}
];
/**
* Get all categories
*/
function getTemplateCategories() {
	return [
		{
			value: "event",
			label: "Events"
		},
		{
			value: "survey",
			label: "Surveys"
		},
		{
			value: "registration",
			label: "Registration"
		},
		{
			value: "feedback",
			label: "Feedback"
		},
		{
			value: "application",
			label: "Applications"
		}
	];
}
function slugify(s) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function NewForm() {
	const navigate = useNavigate();
	const appSettings = useAppSettings();
	const [step, setStep] = (0, import_react.useState)("template");
	const [selectedTemplate, setSelectedTemplate] = (0, import_react.useState)(null);
	const [title, setTitle] = (0, import_react.useState)("");
	const [slug, setSlug] = (0, import_react.useState)("");
	const [slugManual, setSlugManual] = (0, import_react.useState)(false);
	const [description, setDescription] = (0, import_react.useState)("");
	const [category, setCategory] = (0, import_react.useState)("");
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [errors, setErrors] = (0, import_react.useState)({});
	function selectTemplate(template) {
		setSelectedTemplate(template);
		if (template) {
			setTitle(template.name);
			setSlug(slugify(template.name));
			setDescription(template.description);
			setCategory(template.category);
		}
		setStep("details");
	}
	function onTitleChange(v) {
		setTitle(v);
		if (!slugManual) setSlug(slugify(v));
	}
	async function createFromTemplate(formId) {
		if (!selectedTemplate) return;
		for (let i = 0; i < selectedTemplate.sections.length; i++) {
			const section = selectedTemplate.sections[i];
			const { data: sectionData, error: sectionError } = await supabase.from("form_sections").insert({
				form_id: formId,
				title: section.title,
				description: section.description || null,
				position: i
			}).select("id").single();
			if (sectionError || !sectionData) throw new Error(sectionError?.message ?? `Failed to create section "${section.title}"`);
			const questions = section.questions.map((q, idx) => ({
				form_id: formId,
				section_id: sectionData.id,
				type: q.type,
				label: q.label,
				description: q.description || null,
				placeholder: q.placeholder || null,
				required: q.required,
				position: idx,
				options: q.options ?? []
			}));
			const { error: questionsError } = await supabase.from("form_questions").insert(questions);
			if (questionsError) throw new Error(questionsError.message ?? `Failed to create questions for "${section.title}"`);
		}
	}
	async function handleCreate(e) {
		e.preventDefault();
		const parsed = FormCreateSchema.safeParse({
			title,
			slug,
			description: description || void 0,
			category: category || void 0
		});
		if (!parsed.success) {
			setErrors(fieldErrors(parsed.error));
			return;
		}
		setErrors({});
		setSaving(true);
		try {
			const { data: existing } = await supabase.from("forms").select("id").eq("slug", parsed.data.slug).maybeSingle();
			if (existing) {
				setErrors({ slug: "This slug is already in use. Choose another." });
				return;
			}
			const { data: form, error } = await supabase.from("forms").insert({
				title: parsed.data.title,
				slug: parsed.data.slug,
				description: parsed.data.description || null,
				category: parsed.data.category || null,
				confirmation_message: appSettings.default_confirmation_message
			}).select("id").single();
			if (error || !form) {
				if (error?.code === "23505") {
					setErrors({ slug: "This slug is already in use. Choose another." });
					return;
				}
				toast.error(error?.message ?? "Failed to create form");
				return;
			}
			const { error: themeError } = await supabase.from("form_themes").insert({
				form_id: form.id,
				preset: "ith-default"
			});
			if (themeError) {
				toast.error(themeError.message);
				return;
			}
			if (selectedTemplate) {
				await createFromTemplate(form.id);
				toast.success(`Form created from "${selectedTemplate.name}" template`);
			} else {
				const { error: sectionError } = await supabase.from("form_sections").insert({
					form_id: form.id,
					title: "Section 1",
					position: 0
				});
				if (sectionError) {
					toast.error(sectionError.message);
					return;
				}
				toast.success("Form created");
			}
			navigate({
				to: "/forms/$formId/edit",
				params: { formId: form.id }
			});
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to create form");
		} finally {
			setSaving(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-6 max-w-5xl mx-auto",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-2xl font-bold mb-1",
				children: "New Form"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground mb-6",
				children: step === "template" ? "Choose a template or start from scratch" : "Configure your form details"
			}),
			step === "template" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TemplateSelector, { onSelect: selectTemplate }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: handleCreate,
				className: "max-w-xl space-y-5 rounded-xl border border-border/60 bg-card p-6",
				children: [
					selectedTemplate && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30 mb-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-4 w-4 text-primary" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-sm font-medium",
									children: [
										"Using \"",
										selectedTemplate.name,
										"\" template"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground",
									children: selectedTemplate.description
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setStep("template"),
								className: "text-xs text-primary hover:underline",
								children: "Change"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Form Title *",
						error: errors.title,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							value: title,
							onChange: (e) => onTitleChange(e.target.value),
							required: true,
							"aria-invalid": !!errors.title,
							className: inputCls,
							placeholder: "e.g. Event Registration 2026"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "URL Slug *",
						hint: `Public URL: /forms/${slug || "your-slug"}`,
						error: errors.slug,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							value: slug,
							onChange: (e) => {
								setSlug(slugify(e.target.value));
								setSlugManual(true);
							},
							required: true,
							pattern: "[a-z0-9-]+",
							"aria-invalid": !!errors.slug,
							className: inputCls + " font-mono",
							placeholder: "event-registration-2026"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Description",
						error: errors.description,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							value: description,
							onChange: (e) => setDescription(e.target.value),
							rows: 3,
							className: textareaCls,
							placeholder: "Brief description shown to respondents"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Category",
						error: errors.category,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: category,
							onChange: (e) => setCategory(e.target.value),
							className: selectCls + " w-full bg-background",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "",
								children: "Select category…"
							}), [
								"Event Registration",
								"Application",
								"Survey",
								"Feedback",
								"Internship",
								"Workshop",
								"Other"
							].map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: c,
								children: c
							}, c))]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-3 pt-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								if (selectedTemplate) setStep("template");
								else navigate({ to: "/forms" });
							},
							className: "flex-1 h-10 rounded-md border border-border text-sm hover:bg-secondary transition-colors",
							children: selectedTemplate ? "Back" : "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoadingButton, {
							type: "submit",
							loading: saving,
							className: "flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60",
							children: "Create Form"
						})]
					})
				]
			})
		]
	}) });
}
function TemplateSelector({ onSelect }) {
	const [filter, setFilter] = (0, import_react.useState)("all");
	const categories = getTemplateCategories();
	const templates = filter === "all" ? FORM_TEMPLATES : FORM_TEMPLATES.filter((t) => t.category === filter);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2 overflow-x-auto pb-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setFilter("all"),
					className: `px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === "all" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"}`,
					children: "All Templates"
				}), categories.map((cat) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setFilter(cat.value),
					className: `px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === cat.value ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"}`,
					children: cat.label
				}, cat.value))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => onSelect(null),
				className: "w-full text-left rounded-xl border-2 border-dashed border-border/60 hover:border-primary/60 bg-card p-5 transition-colors group",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "shrink-0 h-12 w-12 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/20 transition-colors",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "h-6 w-6 text-muted-foreground group-hover:text-primary" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-semibold mb-1",
							children: "Blank Form"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground",
							children: "Start from scratch with an empty form"
						})]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 md:grid-cols-2",
				children: templates.map((template) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => onSelect(template),
					className: "text-left rounded-xl border border-border/60 hover:border-primary/60 bg-card p-5 transition-colors group",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "shrink-0 h-12 w-12 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/20 transition-colors",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-6 w-6 text-muted-foreground group-hover:text-primary" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 min-w-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 mb-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "font-semibold",
										children: template.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase font-medium",
										children: template.category
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-muted-foreground mb-2",
									children: template.description
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs text-muted-foreground",
									children: [
										template.sections.length,
										" section",
										template.sections.length !== 1 ? "s" : "",
										" · ",
										" ",
										template.sections.reduce((sum, s) => sum + s.questions.length, 0),
										" questions"
									]
								})
							]
						})]
					})
				}, template.id))
			})
		]
	});
}
//#endregion
export { NewForm as component };
