import type { CareerProfile, ProviderSettings } from "./types";

export const emptyProfile: CareerProfile = {
  identity: {
    fullName: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    website: ""
  },
  summary: "",
  skills: [],
  education: [],
  experience: [],
  preferences: {
    workAuthorization: "",
    sponsorship: "",
    relocation: "",
    salary: "",
    noticePeriod: "",
    startDate: "",
    preferredLocations: ""
  },
  resumeText: "",
  resumeFileName: "",
  evidence: [],
  updatedAt: ""
};

export const defaultProviderSettings: ProviderSettings = {
  provider: "deepseek",
  model: "deepseek-v4-flash",
  baseUrl: "https://api.deepseek.com",
  format: "openai",
  authType: "bearer"
};
