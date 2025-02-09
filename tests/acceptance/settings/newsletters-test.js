import {authenticateSession} from 'ember-simple-auth/test-support';
import {click, currentURL, fillIn, find, findAll} from '@ember/test-helpers';
import {expect} from 'chai';
import {setupApplicationTest} from 'ember-mocha';
import {setupMirage} from 'ember-cli-mirage/test-support';
import {visit} from '../../helpers/visit';

describe('Acceptance: Settings - Newsletters', function () {
    const hooks = setupApplicationTest();
    setupMirage(hooks);

    beforeEach(async function () {
        this.server.loadFixtures('configs', 'newsletters');

        const role = this.server.create('role', {name: 'Owner'});
        this.server.create('user', {roles: [role]});

        return await authenticateSession();
    });

    it('redirects old path', async function () {
        await visit('/settings/members-email');
        expect(currentURL()).to.equal('/settings/newsletters');
    });

    it('can manage open rate tracking', async function () {
        this.server.db.settings.update({key: 'email_track_opens'}, {value: 'true'});

        await visit('/settings/newsletters');
        expect(find('[data-test-checkbox="email-track-opens"]')).to.be.checked;

        await click('[data-test-label="email-track-opens"]');
        expect(find('[data-test-checkbox="email-track-opens"]')).to.not.be.checked;

        await click('[data-test-button="save-members-settings"]');

        expect(this.server.db.settings.findBy({key: 'email_track_opens'}).value).to.equal(false);
    });

    async function checkValidationError(errors) {
        // Create the newsletter
        await click('[data-test-button="save-newsletter"]');

        // @todo: at the moment, the tabs don't open on error automatically
        // we need to remove these lines when this is fixed
        // and replace it with something like ± checkTabOpen('genexral')
        // await openTab('general.name');

        for (const selector of Object.keys(errors)) {
            expect(findAll(selector).length, 'field ' + selector + ' is not visible').to.equal(1);
            expect(findAll(selector + ' + .response').length, 'error message is displayed').to.equal(1);
            expect(find(selector + ' + .response').textContent).to.match(errors[selector]);
        }

        // Check button is in error state
        expect(find('[data-test-button="save-newsletter"] > [data-test-task-button-state="failure"]')).to.exist;
    }

    async function checkSave(options) {
        const name = options.edit ? 'edit' : 'create';

        // Create the newsletter
        await click('[data-test-button="save-newsletter"]');

        // No errors
        expect(findAll('.error > .response').length, 'error message is displayed').to.equal(0);

        if (options.verifyEmail) {
            expect(find('[data-test-modal="confirm-newsletter-email"]'), 'Confirm email modal').to.exist;

            // Check message
            if (typeof verifyEmail !== 'boolean') {
                const t = find('[data-test-modal="confirm-newsletter-email"] p').textContent.trim().replace(/\s+/g, ' ');
                expect(t).to.match(options.verifyEmail, t);
            }
            await click('[data-test-button="confirm-newsletter-email"]');
        }

        // Check if modal closes on save
        expect(find(`[data-test-modal="${name}-newsletter"]`), 'Newsletter modal should disappear after saving').to.not.exist;
    }

    async function checkCancel(options) {
        const name = options.edit ? 'edit' : 'create';

        // Create the newsletter
        await click('[data-test-button="cancel-newsletter"]');

        if (options.shouldConfirm) {
            expect(find('[data-test-modal="unsaved-settings"]'), 'Confirm unsaved settings modal should be visible').to.exist;
            await click('[data-test-leave-button]');
        }

        // Check if modal closes on save
        expect(find(`[data-test-modal="${name}-newsletter"]`), 'Newsletter modal should disappear after canceling').to.not.exist;
    }

    async function openTab(name, optional = true) {
        const generalToggleSelector = '[data-test-nav-toggle="' + name + '"]';
        const generalToggle = find(generalToggleSelector);
        const doesExist = !!generalToggle;

        if (!doesExist && !optional) {
            throw new Error('Expected tab ' + name + ' to exist');
        }

        if (doesExist && !generalToggle.classList.contains('active')) {
            await click(generalToggleSelector);

            if (!generalToggle.classList.contains('active')) {
                throw new Error('Could not open ' + name + ' tab');
            }
        }
    }

    async function closeTab(name, optional = true) {
        const generalToggleSelector = '[data-test-nav-toggle="' + name + '"]';
        const generalToggle = find(generalToggleSelector);
        const doesExist = !!generalToggle;

        if (!doesExist && !optional) {
            throw new Error('Expected tab ' + name + ' to exist');
        }

        if (doesExist && generalToggle.classList.contains('active')) {
            await click(generalToggleSelector);

            if (generalToggle.classList.contains('active')) {
                throw new Error('Could not close ' + name + ' tab');
            }
        }
    }

    async function fillName(name) {
        await openTab('general.name');
        await fillIn('input#newsletter-title', name);
    }

    it('can create new newsletter', async function () {
        await visit('/settings/newsletters');
        await click('[data-test-button="add-newsletter"]');

        // Check if modal opens
        expect(find('[data-test-modal="create-newsletter"]'), 'Create newsletter modal').to.exist;

        // Fill in the newsletter name
        await fillName('My new newsletter');

        // Fill in the newsletter description
        await fillIn('textarea#newsletter-description', 'My newsletter description');

        await checkSave({});
    });

    it('validates create newsletter before saving', async function () {
        await visit('/settings/newsletters');
        await click('[data-test-button="add-newsletter"]');

        // Check if modal opens
        expect(find('[data-test-modal="create-newsletter"]'), 'Create newsletter modal').to.exist;

        // Invalid name error when you try to save
        await checkValidationError({'input#newsletter-title': /Please enter a name./});

        // Fill in the newsletter name
        await fillName('My new newsletter');

        // Everything should be valid
        await checkSave({});
    });

    it('can edit via menu if multiple newsletters', async function () {
        // Create an extra newsletter
        this.server.create('newsletter', {status: 'active', name: 'test newsletter', slug: 'test-newsletter'});
        await visit('/settings/newsletters');

        await click('[data-test-newsletter-menu-trigger]');
        await click('[data-test-button="customize-newsletter"]');

        // Check if modal opens
        expect(find('[data-test-modal="edit-newsletter"]'), 'Edit newsletter modal').to.exist;
    });

    it('validates edit fields before saving', async function () {
        await visit('/settings/newsletters');

        // When we only have a single newsletter, the customize button is shown instead of the menu button
        await click('[data-test-button="customize-newsletter"]');

        // Check if modal opens
        expect(find('[data-test-modal="edit-newsletter"]'), 'Edit newsletter modal').to.exist;

        // Clear newsletter name
        await fillName('');

        // Invalid name error when you try to save
        await checkValidationError({'input#newsletter-title': /Please enter a name./});

        // Fill in the newsletter name
        await fillName('My new newsletter');

        // Enter an invalid email
        await openTab('general.email');
        await fillIn('input#newsletter-sender-email', 'invalid-email');

        // Check if it complains about the invalid email
        await checkValidationError({
            'input#newsletter-sender-email': /Invalid email./
        });

        await fillIn('input#newsletter-sender-email', 'valid-email@email.com');

        // Everything should be valid
        await checkSave({
            edit: true,
            verifyEmail: /default email address \(noreply/
        });
    });

    it('can open / close all tabs', async function () {
        await visit('/settings/newsletters');

        // When we only have a single newsletter, the customize button is shown instead of the menu button
        await click('[data-test-button="customize-newsletter"]');

        // Check if modal opens
        expect(find('[data-test-modal="edit-newsletter"]'), 'Edit newsletter modal').to.exist;

        await openTab('general.name', false);
        await closeTab('general.name', false);

        await openTab('general.email', false);
        await closeTab('general.email', false);

        await openTab('general.member', false);
        await closeTab('general.member', false);

        await openTab('design.header', false);
        await closeTab('design.header', false);

        await openTab('design.body', false);
        await closeTab('design.body', false);

        await openTab('design.footer', false);
        await closeTab('design.footer', false);
    });

    it('shows current sender email in verify modal', async function () {
        this.server.create('newsletter', {status: 'active', name: 'test newsletter', slug: 'test-newsletter', senderEmail: 'test@example.com'});

        await visit('/settings/newsletters');

        // Edit the last newsletter
        await click('[data-test-newsletter="test-newsletter"] [data-test-newsletter-menu-trigger]');
        await click('[data-test-button="customize-newsletter"]');

        // Check if modal opens
        expect(find('[data-test-modal="edit-newsletter"]'), 'Edit newsletter modal').to.exist;

        await openTab('general.email');
        await fillIn('input#newsletter-sender-email', 'valid-email@email.com');

        // Everything should be valid
        await checkSave({
            edit: true,
            verifyEmail: /previous email address \(test@example\.com\)/
        });
    });

    it('does not ask to confirm saved changes', async function () {
        await visit('/settings/newsletters');

        // When we only have a single newsletter, the customize button is shown instead of the menu button
        await click('[data-test-button="customize-newsletter"]');

        // Check if modal opens
        expect(find('[data-test-modal="edit-newsletter"]'), 'Edit newsletter modal').to.exist;

        // Make no changes

        // Everything should be valid
        await checkCancel({
            edit: true,
            shouldConfirm: false
        });
    });

    it('asks to confirm unsaved changes', async function () {
        async function doCheck(tabName, field) {
            await visit('/settings/newsletters');

            // When we only have a single newsletter, the customize button is shown instead of the menu button
            await click('[data-test-button="customize-newsletter"]');

            // Check if modal opens
            expect(find('[data-test-modal="edit-newsletter"]'), 'Edit newsletter modal').to.exist;

            // Make a change
            await openTab(tabName, false);
            if (field.input) {
                await fillIn(field.input, field.value ?? 'my changed value');
            } else if (field.toggle) {
                await click(field.toggle);
            } else if (field.dropdown) {
                // Open dropdown
                await click(`${field.dropdown} .ember-basic-dropdown-trigger`);

                // Click first not-selected option
                await click(`${field.dropdown} li.ember-power-select-option[aria-current="false"]`);
            }

            // Everything should be valid
            await checkCancel({
                edit: true,
                shouldConfirm: true
            });
        }

        // General name
        await doCheck('general.name', {
            input: '#newsletter-title'
        });

        await doCheck('general.name', {
            input: '#newsletter-description'
        });

        // General email
        await doCheck('general.email', {
            input: '#newsletter-sender-name'
        });

        await doCheck('general.email', {
            input: '#newsletter-sender-email'
        });

        await doCheck('general.email', {
            input: '#newsletter-reply-to',
            value: 'support'
        });

        // Member settings
        await doCheck.call(this, 'general.member', {
            toggle: '[data-test-toggle="subscribeOnSignup"]'
        });

        // Design header
        await doCheck.call(this, 'design.header', {
            toggle: '[data-test-toggle="showHeaderTitle"]'
        });

        await doCheck.call(this, 'design.header', {
            toggle: '[data-test-toggle="showHeaderName"]'
        });

        // Design body
        await doCheck.call(this, 'design.body', {
            dropdown: '[data-test-input="titleFontCategory"]'
        });

        await doCheck.call(this, 'design.body', {
            toggle: '#newsletter-title-alignment button:not(.gh-btn-group-selected)'
        });

        await doCheck.call(this, 'design.body', {
            dropdown: '[data-test-input="bodyFontCategory"]'
        });

        await doCheck.call(this, 'design.body', {
            toggle: '#show-feature-image'
        });

        // Design footer
        await doCheck('design.footer', {
            input: '[contenteditable="true"]'
        });
    });
});
