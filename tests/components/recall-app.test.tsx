import { render, screen } from "@testing-library/react";
import Page from "@/app/page";

it("introduces Recall as a misconception detector", () => {
  render(<Page />);
  expect(
    screen.getByRole("heading", {
      name: /can you explain what you think you know/i,
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /start sample lesson/i }),
  ).toBeEnabled();
});
