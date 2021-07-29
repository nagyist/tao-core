/**
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; under version 2
 * of the License (non-upgradable).
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * Copyright (c) 2021 (original work) Open Assessment Technologies SA ;
 */

import '@oat-sa/e2e-runner/support/auth';
import '@oat-sa/e2e-runner/support/lti.js';
import './resourceTree'
import './userManagement'
import urls from '../utils/urls';

Cypress.Commands.add('loginAsUser', (username, password) => {
    cy.login({ url: urls.login, username, password });
});

Cypress.Commands.add('loginAsAdmin', () => {
    const username = Cypress.env('adminUser');
    const password = Cypress.env('adminPass');

    cy.loginAsUser(username, password);
});

// Logs out using the UI
Cypress.Commands.add('logoutAttempt', () => {
    cy.get('#logout').click()
});

// Creates a UI login attempt with provided data
Cypress.Commands.add('loginAttempt', (username, password) => {
    cy.intercept('POST', '**/login*').as('login');
    cy.get('#login', { timeout: 10000 }).type(username);
    cy.get('#password').type(password);
    cy.get('#connect').click();
    cy.wait('@login', {
        requestTimeout: 10000
    });
});

// Preserve session cookies to stay logged in to TAO during tests
Cypress.Cookies.defaults({
    preserve: (cookie) => {
        return cookie.name.startsWith('tao_');
    }
});