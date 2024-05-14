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
 * Copyright (c) 2021-2024 (original work) Open Assessment Technologies SA;
 */

declare(strict_types=1);

namespace oat\tao\model\action;

use Laminas\ServiceManager\ServiceLocatorAwareTrait;
use oat\oatbox\service\ConfigurableService;
use oat\tao\model\featureFlag\FeatureFlagChecker;

class ActionBlackList extends ConfigurableService
{
    use ServiceLocatorAwareTrait;

    public const SERVICE_ID = 'tao/ActionBlackList';
    public const OPTION_DISABLED_ACTIONS = 'disabledActions';
    public const OPTION_DISABLED_ACTIONS_FLAG_MAP = 'disabledActionsMap';
    public const OPTION_ENABLED_ACTIONS_BY_FEATURE_FLAG_MAP = 'enabledActionsByFeatureFlagMap';

    public function isDisabled(string $action): bool
    {
        return ($this->isDisabledByDefault($action) && !$this->isEnabledByFeatureFlag($action))
            || $this->isDisabledByFeatureFlag($action);
    }

    private function isDisabledByDefault(string $action): bool
    {
        return array_search($action, (array) $this->getOption(self::OPTION_DISABLED_ACTIONS, [])) !== false;
    }

    private function isDisabledByFeatureFlag(string $action): bool
    {
        $disabledActionsMap = $this->getOption(self::OPTION_DISABLED_ACTIONS_FLAG_MAP, []);
        return isset($disabledActionsMap[$action])
            && $this->getFeatureFlagChecker()->isEnabled($disabledActionsMap[$action]);
    }

    private function isEnabledByFeatureFlag(string $action): bool
    {
        $enabledActionsByFeatureFlagMap = $this->getOption(self::OPTION_ENABLED_ACTIONS_BY_FEATURE_FLAG_MAP, []);
        return isset($enabledActionsByFeatureFlagMap[$action])
            && $this->getFeatureFlagChecker()->isEnabled($enabledActionsByFeatureFlagMap[$action]);
    }

    private function getFeatureFlagChecker(): FeatureFlagChecker
    {
        return $this->getServiceLocator()->get(FeatureFlagChecker::class);
    }
}
