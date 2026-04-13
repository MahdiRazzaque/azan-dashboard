import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Renders a component wrapped in common providers for testing.
 * @param {React.ReactElement} ui - Component to render
 * @param {object} [options] - Options
 * @param {string} [options.route='/'] - Initial route for MemoryRouter
 * @param {object} [options.renderOptions] - Additional render options
 * @returns {import('@testing-library/react').RenderResult} Render result
 */
export function renderWithProviders(ui, { route = '/', ...renderOptions } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>,
    renderOptions
  );
}
