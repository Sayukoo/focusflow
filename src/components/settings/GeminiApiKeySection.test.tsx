import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiApiKeySection } from "./GeminiApiKeySection";
import {
  GEMINI_API_KEY_STORAGE_KEY,
  saveStoredGeminiApiKey,
} from "../../lib/gemini";

function expand() {
  fireEvent.click(
    screen.getByRole("button", { name: "Rozwiń klucz Gemini API" }),
  );
}

describe("GeminiApiKeySection", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("renders with unconfigured badge when no key is saved", () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "");
    render(<GeminiApiKeySection />);

    expect(screen.getByText("Brak klucza")).toBeInTheDocument();
    // Brak klucza → od razu rozwinięte, żeby wkleić klucz.
    expect(screen.getByPlaceholderText(/Wklej klucz API/)).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("renders minimal collapsed row when key exists in localStorage", () => {
    saveStoredGeminiApiKey("AIzaSyTestKey123");
    render(<GeminiApiKeySection />);

    expect(screen.getByText("Aktywny")).toBeInTheDocument();
    // Minimalistycznie zwinięte — input dopiero po rozwinięciu.
    expect(
      screen.queryByDisplayValue("AIzaSyTestKey123"),
    ).not.toBeInTheDocument();

    expand();
    expect(screen.getByDisplayValue("AIzaSyTestKey123")).toBeInTheDocument();
  });

  it("allows entering, saving, and persisting a new API key", () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "");
    const onKeyChange = vi.fn();
    render(<GeminiApiKeySection onKeyChange={onKeyChange} />);

    const input = screen.getByPlaceholderText(/Wklej klucz API/);
    const saveButton = screen.getByRole("button", { name: "Zapisz klucz API" });

    fireEvent.change(input, { target: { value: "AIzaSyNewCustomKey" } });
    fireEvent.click(saveButton);

    expect(localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)).toBe(
      "AIzaSyNewCustomKey",
    );
    expect(onKeyChange).toHaveBeenCalledWith("AIzaSyNewCustomKey");
    expect(screen.getByText("Aktywny")).toBeInTheDocument();
    // Po zapisie wraca do formy ikonki.
    expect(
      screen.queryByDisplayValue("AIzaSyNewCustomKey"),
    ).not.toBeInTheDocument();
  });

  it("toggles key visibility between password and text", () => {
    saveStoredGeminiApiKey("AIzaSySecret");
    render(<GeminiApiKeySection />);
    expand();

    const input = screen.getByDisplayValue("AIzaSySecret");
    expect(input).toHaveAttribute("type", "password");

    const toggleBtn = screen.getByRole("button", { name: "Pokaż klucz API" });
    fireEvent.click(toggleBtn);
    expect(input).toHaveAttribute("type", "text");

    const hideBtn = screen.getByRole("button", { name: "Ukryj klucz API" });
    fireEvent.click(hideBtn);
    expect(input).toHaveAttribute("type", "password");
  });

  it("allows deleting the stored key", () => {
    saveStoredGeminiApiKey("AIzaSyToDelete");
    const onKeyChange = vi.fn();
    render(<GeminiApiKeySection onKeyChange={onKeyChange} />);
    expand();

    const deleteBtn = screen.getByRole("button", {
      name: "Usuń zapisany klucz API",
    });
    fireEvent.click(deleteBtn);

    expect(localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)).toBeNull();
    expect(onKeyChange).toHaveBeenCalledWith("");
    expect(screen.getByText("Brak klucza")).toBeInTheDocument();
  });
});
