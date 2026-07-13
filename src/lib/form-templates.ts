/**
 * Form Templates Library
 * Pre-built form structures for common use cases
 */

import type { QuestionType } from "./question-types";

export type TemplateQuestion = {
  type: QuestionType;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  options?: { label: string; value: string }[];
};

export type TemplateSection = {
  title: string;
  description?: string;
  questions: TemplateQuestion[];
};

export type FormTemplate = {
  id: string;
  name: string;
  description: string;
  category: "event" | "survey" | "registration" | "feedback" | "application";
  icon: string;
  sections: TemplateSection[];
};

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "event-rsvp",
    name: "Event RSVP",
    description: "Collect attendee information and meal preferences for events",
    category: "event",
    icon: "calendar",
    sections: [
      {
        title: "Attendee Information",
        description: "Tell us about yourself",
        questions: [
          {
            type: "short_text",
            label: "Full Name",
            required: true,
            placeholder: "Jane Smith",
          },
          {
            type: "email",
            label: "Email Address",
            required: true,
            placeholder: "jane@example.com",
          },
          {
            type: "phone",
            label: "Phone Number",
            required: false,
            placeholder: "+1234567890",
          },
        ],
      },
      {
        title: "Event Details",
        description: "Confirm your attendance",
        questions: [
          {
            type: "yes_no",
            label: "Will you be attending?",
            required: true,
          },
          {
            type: "dropdown",
            label: "Meal Preference",
            required: false,
            options: [
              { label: "Chicken", value: "chicken" },
              { label: "Vegetarian", value: "vegetarian" },
              { label: "Vegan", value: "vegan" },
              { label: "Gluten-free", value: "gluten_free" },
            ],
          },
          {
            type: "checkbox",
            label: "Dietary Restrictions",
            required: false,
            options: [
              { label: "Nut allergy", value: "nut_allergy" },
              { label: "Dairy-free", value: "dairy_free" },
              { label: "Shellfish allergy", value: "shellfish_allergy" },
              { label: "Other", value: "other" },
            ],
          },
          {
            type: "long_text",
            label: "Special Requests or Comments",
            required: false,
            placeholder: "Any additional information we should know?",
          },
        ],
      },
    ],
  },
  {
    id: "customer-feedback",
    name: "Customer Feedback",
    description: "Gather customer satisfaction ratings and comments",
    category: "feedback",
    icon: "message-square",
    sections: [
      {
        title: "Your Experience",
        description: "Help us improve our service",
        questions: [
          {
            type: "rating",
            label: "Overall Satisfaction",
            description: "Rate your experience from 1 to 5 stars",
            required: true,
          },
          {
            type: "linear_scale",
            label: "Likelihood to Recommend",
            description: "How likely are you to recommend us? (1-10)",
            required: true,
          },
          {
            type: "checkbox",
            label: "What did you like?",
            required: false,
            options: [
              { label: "Product quality", value: "quality" },
              { label: "Customer service", value: "service" },
              { label: "Pricing", value: "pricing" },
              { label: "Fast delivery", value: "delivery" },
              { label: "Easy to use", value: "usability" },
            ],
          },
          {
            type: "long_text",
            label: "Additional Comments",
            required: false,
            placeholder: "Tell us more about your experience...",
          },
        ],
      },
    ],
  },
  {
    id: "contact-form",
    name: "Contact Form",
    description: "Simple contact form for inquiries and support",
    category: "feedback",
    icon: "mail",
    sections: [
      {
        title: "Contact Information",
        questions: [
          {
            type: "short_text",
            label: "Name",
            required: true,
          },
          {
            type: "email",
            label: "Email",
            required: true,
          },
          {
            type: "phone",
            label: "Phone (optional)",
            required: false,
          },
        ],
      },
      {
        title: "Your Message",
        questions: [
          {
            type: "dropdown",
            label: "Subject",
            required: true,
            options: [
              { label: "General Inquiry", value: "general" },
              { label: "Technical Support", value: "support" },
              { label: "Sales", value: "sales" },
              { label: "Feedback", value: "feedback" },
              { label: "Other", value: "other" },
            ],
          },
          {
            type: "long_text",
            label: "Message",
            required: true,
            placeholder: "How can we help you?",
          },
        ],
      },
    ],
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
            required: true,
          },
          {
            type: "email",
            label: "Email Address",
            required: true,
          },
          {
            type: "phone",
            label: "Phone Number",
            required: true,
          },
          {
            type: "url",
            label: "LinkedIn Profile (optional)",
            required: false,
            placeholder: "https://linkedin.com/in/yourprofile",
          },
        ],
      },
      {
        title: "Position Details",
        questions: [
          {
            type: "dropdown",
            label: "Position Applying For",
            required: true,
            options: [
              { label: "Software Engineer", value: "software_engineer" },
              { label: "Product Manager", value: "product_manager" },
              { label: "Designer", value: "designer" },
              { label: "Marketing Specialist", value: "marketing" },
              { label: "Other", value: "other" },
            ],
          },
          {
            type: "radio",
            label: "Employment Type",
            required: true,
            options: [
              { label: "Full-time", value: "full_time" },
              { label: "Part-time", value: "part_time" },
              { label: "Contract", value: "contract" },
              { label: "Internship", value: "internship" },
            ],
          },
        ],
      },
      {
        title: "Experience",
        questions: [
          {
            type: "number",
            label: "Years of Experience",
            required: true,
          },
          {
            type: "long_text",
            label: "Why are you a good fit?",
            required: true,
            placeholder: "Tell us about your relevant experience and skills...",
          },
          {
            type: "file",
            label: "Resume / CV",
            description: "PDF or Word document (max 10MB)",
            required: true,
          },
          {
            type: "file",
            label: "Cover Letter (optional)",
            required: false,
          },
        ],
      },
    ],
  },
  {
    id: "course-registration",
    name: "Course Registration",
    description: "Student enrollment form with course selection",
    category: "registration",
    icon: "graduation-cap",
    sections: [
      {
        title: "Student Information",
        questions: [
          {
            type: "short_text",
            label: "Student Name",
            required: true,
          },
          {
            type: "email",
            label: "Email Address",
            required: true,
          },
          {
            type: "short_text",
            label: "Student ID (if applicable)",
            required: false,
          },
        ],
      },
      {
        title: "Course Selection",
        questions: [
          {
            type: "dropdown",
            label: "Course",
            required: true,
            options: [
              { label: "Introduction to Programming", value: "intro_programming" },
              { label: "Web Development", value: "web_dev" },
              { label: "Data Science Fundamentals", value: "data_science" },
              { label: "Machine Learning", value: "machine_learning" },
              { label: "Mobile App Development", value: "mobile_dev" },
            ],
          },
          {
            type: "radio",
            label: "Session",
            required: true,
            options: [
              { label: "Morning (9 AM - 12 PM)", value: "morning" },
              { label: "Afternoon (1 PM - 4 PM)", value: "afternoon" },
              { label: "Evening (6 PM - 9 PM)", value: "evening" },
            ],
          },
          {
            type: "yes_no",
            label: "Have you taken courses with us before?",
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "survey-satisfaction",
    name: "Satisfaction Survey",
    description: "Comprehensive satisfaction and experience survey",
    category: "survey",
    icon: "clipboard-list",
    sections: [
      {
        title: "Overall Experience",
        questions: [
          {
            type: "rating",
            label: "Overall Satisfaction",
            required: true,
          },
          {
            type: "linear_scale",
            label: "Net Promoter Score",
            description: "On a scale of 1-10, how likely are you to recommend us?",
            required: true,
          },
        ],
      },
      {
        title: "Detailed Feedback",
        questions: [
          {
            type: "radio",
            label: "How often do you use our service?",
            required: true,
            options: [
              { label: "Daily", value: "daily" },
              { label: "Weekly", value: "weekly" },
              { label: "Monthly", value: "monthly" },
              { label: "Rarely", value: "rarely" },
            ],
          },
          {
            type: "checkbox",
            label: "Which features do you use most?",
            required: false,
            options: [
              { label: "Feature A", value: "feature_a" },
              { label: "Feature B", value: "feature_b" },
              { label: "Feature C", value: "feature_c" },
              { label: "Feature D", value: "feature_d" },
            ],
          },
          {
            type: "long_text",
            label: "What can we improve?",
            required: false,
            placeholder: "Your suggestions help us get better...",
          },
        ],
      },
    ],
  },
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: FormTemplate["category"]): FormTemplate[] {
  return FORM_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get all categories
 */
export function getTemplateCategories(): Array<{ value: FormTemplate["category"]; label: string }> {
  return [
    { value: "event", label: "Events" },
    { value: "survey", label: "Surveys" },
    { value: "registration", label: "Registration" },
    { value: "feedback", label: "Feedback" },
    { value: "application", label: "Applications" },
  ];
}
