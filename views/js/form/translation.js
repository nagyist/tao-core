/*
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
 * Copyright (c) 2024 (original work) Open Assessment Technologies SA
 *
 */
define([
    'i18n',
    'ui/component',
    'ui/dialog/alert',
    'ui/dialog/confirm',
    'services/translation',
    'tpl!form/tpl/translation',
    'ui/datatable'
], function (__, componentFactory, dialogAlert, dialogConfirm, translationService, translationTpl) {
    ('use strict');

    const defaults = {
        sortBy: 'language',
        sortOrder: 'asc'
    };

    const labels = {
        confirmTranslate: __('Are you sure you want to start the translation for this language?'),
        missingLanguage: __('Please select a language.'),
        translateAction: __('Edit')
    };

    /**
     * Sorts a list of object by the given key.
     * @param {Array} list - The list of objects to sort.
     * @param {string} key - The key to sort the list by.
     * @param {string} order - The order to sort the list. Can be 'asc' or 'desc'.
     * @returns {Array} - The sorted list. However, the original list is also sorted.
     */
    function sortBy(list, key, order = 'asc') {
        return list.sort((a, b) => {
            return a[key].localeCompare(b[key]) * (order === 'asc' ? 1 : -1);
        });
    }

    /**
     * Creates a translation form component.
     * @param {jQuery} $container - The place where to render the component.
     * @param {Object} config - The configuration object.
     * @param {string} config.rootClassUri - The URI of the root class.
     * @param {string} config.resourceUri - The URI of the resource to translate.
     * @returns {Component} - The form component.
     * @emits ready - When the component is ready to be used.
     * @emits create - When a translation is created.
     * @emits edit - When a translation needs to be edited.
     * @emits error - When an error occurs.
     */
    return function translationFormFactory($container, { rootClassUri, resourceUri } = {}) {
        const api = {
            /**
             * Queries the available languages and translations for the resource.
             * @returns {Promise}
             */
            getData() {
                return Promise.all([
                    translationService.getLanguages().then(languages => sortBy(languages, 'label')),
                    translationService.getTranslations(resourceUri).then(translations => translations.resources)
                ]).then(([languages, translations]) => {
                    return {
                        languages: translationService.listAvailableLanguages(translations, languages),
                        translations: translationService.listTranslatedLanguages(translations, languages).map(row => {
                            row.id = row.languageUri;
                            return row;
                        })
                    };
                });
            },

            /**
             * Prepare the lis of translations for the grid.
             * @param {object[]} translations
             * @returns {object}
             */
            prepareGridData(translations) {
                return { data: sortBy(translations, this.config.sortBy, this.config.sortOrder) };
            },

            /**
             * Creates a translation for the given language.
             * @param {string} languageUri - The URI of the language to translate to.
             * @emits create - When the translation is created.
             * @returns {Promise<string>} - Resolves when the translation is created.
             * @emits edit - When the translation is created for the user to edit it.
             * @emits error - When an error occurs.
             */
            createTranslation(languageUri) {
                return translationService
                    .createTranslation(resourceUri, languageUri, rootClassUri)
                    .then(response => {
                        /**
                         * @event create
                         * @param {string} translationUri - The URI of the translated resource
                         * @param {string} languageUri - The URI of the translated language
                         */
                        this.trigger('create', response.resourceUri, languageUri);
                        return response.resourceUri;
                    })
                    .catch(error => this.trigger('error', error));
            },

            /**
             * Initiates the editing of a translation.
             * @param {string} translationUri - The URI of the translated resource.
             * @param {string} languageUri  - The URI of the translated language.
             * @emits edit - For the user to edit the translation.
             */
            editTranslation(translationUri, languageUri) {
                /**
                 * @event edit
                 * @param {string} translationUri - The URI of the translated resource
                 * @param {string} languageUri - The URI of the translated language
                 */
                this.trigger('edit', translationUri, languageUri);
            }
        };

        const component = componentFactory(api, defaults)
            .setTemplate(translationTpl)
            .on('render', function onRender() {
                const $element = this.getElement();
                this.controls = {
                    $tableContainer: $element.find('.translations-list'),
                    $createButton: $element.find('.translations-create [data-control="create"]'),
                    $languageSelect: $element.find('.translations-create [data-control="select"]')
                };

                this.controls.$createButton.on('click', () => {
                    const languageUri = this.controls.$languageSelect.val();
                    const resume = () => this.controls.$createButton.prop('disabled', false);
                    this.controls.$createButton.prop('disabled', true);

                    if (!languageUri) {
                        return dialogAlert(labels.missingLanguage, resume);
                    }
                    dialogConfirm(
                        labels.confirmTranslate,
                        () => this.createTranslation(languageUri).then(resume),
                        resume
                    );
                });

                this.controls.$tableContainer.datatable(
                    {
                        model: [
                            { id: 'language', label: 'Language' },
                            { id: 'progress', label: 'Status' }
                        ],
                        labels: {
                            actions: ''
                        },
                        paginationStrategyTop: 'none',
                        paginationStrategyBottom: 'none',
                        actions: [
                            {
                                id: 'translate',
                                label: labels.translateAction,
                                cls: 'btn-secondary',
                                action(languageUri, translation) {
                                    component.editTranslation(translation.resourceUri, languageUri);
                                }
                            }
                        ]
                    },
                    this.prepareGridData(this.config.translations)
                );

                /**
                 * @event ready
                 */
                this.trigger('ready');
            })
            .on('create', function onCreate(translationUri, languageUri) {
                this.controls.$languageSelect.find(`option[value="${languageUri}"]`).remove();
                if (this.controls.$languageSelect.find('option').length === 1) {
                    this.getElement().find('.translations-create').hide();
                }
                return this.getData()
                    .then(data => {
                        this.controls.$tableContainer.datatable('refresh', this.prepareGridData(data.translations));
                    })
                    .then(() => this.editTranslation(translationUri, languageUri))
                    .catch(error => this.trigger('error', error));
            })
            .on('disable', function onDisable() {
                if (!this.is('rendered')) {
                    return;
                }
                this.getElement().prop('disabled', true);
                this.controls.$createButton.prop('disabled', true);
                this.controls.$languageSelect.prop('disabled', true);
                this.controls.$tableContainer.datatable('disable');
            })
            .on('enable', function onEnable() {
                if (!this.is('rendered')) {
                    return;
                }
                this.getElement().prop('disabled', false);
                this.controls.$createButton.prop('disabled', false);
                this.controls.$languageSelect.prop('disabled', false);
                this.controls.$tableContainer.datatable('enable');
            });

        translationService
            .getTranslatable(resourceUri)
            .then(response => {
                const config = {
                    ready: translationService.isReadyForTranslation(response.resources),
                    renderTo: $container,
                    languages: [],
                    translations: []
                };

                if (!config.ready) {
                    return config;
                }

                return component.getData().then(data => ({ ...config, ...data }));
            })
            .then(config => component.init(config))
            .catch(error => component.trigger('error', error));

        return component;
    };
});
