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
 * Copyright (c) 2021 (original work) Open Assessment Technologies SA.
 */

declare(strict_types=1);

namespace oat\tao\model\user\implementation;

use oat\generis\model\data\Ontology;
use oat\generis\model\GenerisRdf;
use oat\oatbox\user\UserTimezoneServiceInterface;
use oat\tao\model\featureFlag\FeatureFlagCheckerInterface;
use oat\tao\model\user\UserSettingsInterface;
use oat\tao\model\user\UserSettingsServiceInterface;
use core_kernel_classes_Resource;
use tao_models_classes_UserService;

class UserSettingsService implements UserSettingsServiceInterface
{
    /** @var Ontology */
    private $ontology;

    /** @var string */
    private $defaultTimeZone;

    /** @var tao_models_classes_UserService */
    private $userService;

    /** @var FeatureFlagCheckerInterface */
    private $featureFlagChecker;

    public function __construct(
        UserTimezoneServiceInterface $userTimezoneService,
        Ontology $ontology,
        tao_models_classes_UserService $userService,
        FeatureFlagCheckerInterface $featureFlagChecker
    ) {
        $this->defaultTimeZone = $userTimezoneService->getDefaultTimezone();
        $this->ontology = $ontology;
        $this->userService = $userService;
        $this->featureFlagChecker = $featureFlagChecker;
    }

    public function get(core_kernel_classes_Resource $user): UserSettingsInterface
    {
        $props = $user->getPropertiesValues(
            [
                $this->ontology->getProperty(GenerisRdf::PROPERTY_USER_UILG),
                $this->ontology->getProperty(GenerisRdf::PROPERTY_USER_DEFLG),
                $this->ontology->getProperty(GenerisRdf::PROPERTY_USER_TIMEZONE),
                $this->ontology->getProperty(GenerisRdf::PROPERTY_USER_INTERFACE_MODE)
            ]
        );

        if (!empty($props[GenerisRdf::PROPERTY_USER_UILG])) {
            $uiLanguageCode = current($props[GenerisRdf::PROPERTY_USER_UILG])->getUri();
        }

        if (!empty($props[GenerisRdf::PROPERTY_USER_DEFLG])) {
            $dataLanguageCode = current($props[GenerisRdf::PROPERTY_USER_DEFLG])->getUri();
        }

        if (!empty($props[GenerisRdf::PROPERTY_USER_TIMEZONE])) {
            $timezone = (string) current($props[GenerisRdf::PROPERTY_USER_TIMEZONE]);
        }

        $userSettings = new UserSettings(
            $timezone ?? $this->defaultTimeZone,
            $uiLanguageCode ?? null,
            $dataLanguageCode ?? null
        );

        if (
            $this->featureFlagChecker->isEnabled(
                FeatureFlagCheckerInterface::FEATURE_FLAG_SOLAR_DESIGN_ENABLED
            )
        ) {
            $userSettings->setSetting(
                UserSettingsInterface::INTERFACE_MODE,
                empty($props[GenerisRdf::PROPERTY_USER_INTERFACE_MODE])
                    ? GenerisRdf::PROPERTY_USER_INTERFACE_MODE_SIMPLE
                    : current($props[GenerisRdf::PROPERTY_USER_INTERFACE_MODE])->getUri()
            );
        }

        return $userSettings;
    }

    public function getCurrentUserSettings(): UserSettingsInterface
    {
        $currentUser = $this->userService->getCurrentUser();

        if ($currentUser) {
            return $this->get($currentUser);
        }

        return new UserSettings($this->defaultTimeZone);
    }
}
