<?php

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
 * Copyright (c) 2024 (original work) Open Assessment Technologies SA;
 */

declare(strict_types=1);

namespace oat\tao\model\Translation\Entity;

interface ResourceTranslation
{
    public const PROPERTY_TRANSLATION_TYPE = 'http://www.tao.lu/Ontologies/TAO.rdf#TranslationType';
    public const PROPERTY_VALUE_TRANSLATION_TYPE_ORIGINAL = 'http://www.tao.lu/Ontologies/TAO.rdf#TranslationTypeOriginal';
    public const PROPERTY_VALUE_TRANSLATION_TYPE_TRANSLATION = 'http://www.tao.lu/Ontologies/TAO.rdf#TranslationTypeTranslation';

    public const PROPERTY_TRANSLATION_PROGRESS = 'http://www.tao.lu/Ontologies/TAO.rdf#TranslationProgress';
    public const PROPERTY_VALUE_TRANSLATION_PROGRESS_PENDING = 'http://www.tao.lu/Ontologies/TAO.rdf#TranslationProgressStatusPending';
    public const PROPERTY_VALUE_TRANSLATION_PROGRESS_TRANSLATING = 'http://www.tao.lu/Ontologies/TAO.rdf#TranslationProgressStatusTranslating';
    public const PROPERTY_VALUE_TRANSLATION_PROGRESS_TRANSLATED = 'http://www.tao.lu/Ontologies/TAO.rdf#TranslationProgressStatusTranslated';

    public const PROPERTY_TRANSLATION_STATUS = 'http://www.tao.lu/Ontologies/TAO.rdf#TranslationStatus';
    public const PROPERTY_VALUE_TRANSLATION_STATUS_READY = 'http://www.tao.lu/Ontologies/TAO.rdf#TranslationStatusReadyForTranslation';
    public const PROPERTY_VALUE_TRANSLATION_STATUS_NOT_READY = 'http://www.tao.lu/Ontologies/TAO.rdf#TranslationStatusNotReadyForTranslation';

    public const PROPERTY_UNIQUE_IDENTIFIER = 'http://www.tao.lu/Ontologies/TAO.rdf#UniqueIdentifier';
    public const PROPERTY_LANGUAGE = 'http://www.tao.lu/Ontologies/TAO.rdf#Language';
}
