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
 * Copyright (c) 2013-2021 (original work) Open Assessment Technologies SA;
 */

declare(strict_types=1);

namespace oat\tao\model\resources;

use core_kernel_classes_Property;
use oat\generis\model\data\Ontology;
use oat\oatbox\user\User;
use common_exception_Error;
use oat\tao\model\featureFlag\FeatureFlagChecker;
use oat\tao\model\featureFlag\FeatureFlagCheckerInterface;
use oat\tao\model\TaoOntology;
use Psr\Log\LoggerInterface;
use core_kernel_classes_Class;
use core_kernel_classes_Resource;
use oat\oatbox\session\SessionService;
use oat\oatbox\log\logger\AdvancedLogger;
use oat\oatbox\service\ConfigurableService;
use oat\generis\model\data\permission\PermissionInterface;
use oat\oatbox\log\logger\extender\ContextExtenderInterface;

class SecureResourceService extends ConfigurableService implements SecureResourceServiceInterface
{
    private const HIGHEST_PARENT_URI = 'http://www.tao.lu/Ontologies/TAO.rdf#AssessmentContentObject';

    /** @var User */
    private $user;

    /** @var ?bool */
    private $ignoreTranslations;

    /** @var ?core_kernel_classes_Property */
    private $originalUriProperty;

    /**
     * @inheritDoc
     *
     * @throws common_exception_Error
     */
    public function getAllChildren(core_kernel_classes_Class $resource): array
    {
        $subClasses = $resource->getSubClasses(false);
        $accessibleInstances = [[]];
        $permissionService = $this->getPermissionProvider();

        if ($this->ignoreTranslations === null) {
            $this->ignoreTranslations = $this->getFeatureFlagChecker()->isEnabled('FEATURE_FLAG_TRANSLATION_ENABLED');
            $this->originalUriProperty = $this->getOntology()
                ->getProperty(TaoOntology::PROPERTY_TRANSLATION_ORIGINAL_RESOURCE_URI);
        }

        if ($subClasses) {
            foreach ($subClasses as $subClass) {
                $classUri = $subClass->getUri();
                $classPermissions = $permissionService->getPermissions($this->getUser(), [$classUri]);

                if ($this->hasAccess($classPermissions[$classUri])) {
                    $accessibleInstances[] = $this->getAllChildren($subClass);
                }
            }
        }

        return array_merge(
            $this->getInstances($resource),
            ...$accessibleInstances
        );
    }

    /**
     * @return core_kernel_classes_Resource[]
     * @throws common_exception_Error
     */
    private function getInstances(core_kernel_classes_Class $class): array
    {
        $instances = $class->getInstances(false);

        if (!$instances) {
            return [];
        }

        $childrenUris = array_map(
            static function (core_kernel_classes_Resource $child) {
                return $child->getUri();
            },
            $instances
        );

        $permissions = $this->getPermissionProvider()->getPermissions(
            $this->getUser(),
            $childrenUris
        );

        $accessibleInstances = [];

        foreach ($instances as $child) {
            if ($this->ignoreTranslations && !empty($child->getOnePropertyValue($this->originalUriProperty))) {
                continue;
            }

            $uri = $child->getUri();

            if ($this->hasAccess($permissions[$uri])) {
                $accessibleInstances[$uri] = $child;
            }
        }

        return $accessibleInstances;
    }

    private function hasAccess(array $permissions, array $permissionsToCheck = ['READ']): bool
    {
        return $permissions === [PermissionInterface::RIGHT_UNSUPPORTED]
            || empty(array_diff($permissionsToCheck, $permissions));
    }

    /**
     * @param string[] $resourceUris
     * @param string[] $permissionsToCheck
     *
     * @throws common_exception_Error
     */
    private function validateResourceUriPermissions(array $resourceUris, array $permissionsToCheck): void
    {
        $permissionService = $this->getPermissionProvider();

        $permissions = $permissionService->getPermissions(
            $this->getUser(),
            $resourceUris
        );

        foreach ($permissions as $uri => $permission) {
            if (empty($permission) || !$this->hasAccess($permission, $permissionsToCheck)) {
                $this->throwResourceAccessDeniedException($uri);
            }
        }
    }

    /**
     * @param core_kernel_classes_Resource[] $resources
     * @param string[]                       $permissionsToCheck
     *
     * @throws common_exception_Error
     */
    public function validatePermissions(iterable $resources, array $permissionsToCheck): void
    {
        foreach ($resources as $resource) {
            $this->validatePermission($resource, $permissionsToCheck);
        }
    }

    /**
     * @param core_kernel_classes_Resource|string $resource
     * @param array                               $permissionsToCheck
     *
     * @throws common_exception_Error
     */
    public function validatePermission($resource, array $permissionsToCheck): void
    {
        $permissionService = $this->getPermissionProvider();

        if (is_string($resource)) {
            $resource = new core_kernel_classes_Resource($resource);
        }

        $resourceUri = $resource->getUri();
        $permissions = $permissionService->getPermissions($this->getUser(), [$resourceUri]);

        if (!$this->hasAccess($permissions[$resourceUri], $permissionsToCheck)) {
            $this->throwResourceAccessDeniedException($resourceUri);
        }

        $parentUris = $this->getParentUris(
            $this->getClass($resource)
        );

        $this->validateResourceUriPermissions($parentUris, $permissionsToCheck);
    }

    private function getClass(core_kernel_classes_Resource $resource): core_kernel_classes_Class
    {
        if ($resource instanceof core_kernel_classes_Class) {
            return $resource;
        }

        // fetch parent class
        if (!$resource->isClass()) {
            return current($resource->getTypes());
        }

        // the last chance to fetch class form DB
        return $resource->getClass($resource->getUri());
    }

    private function getParentUris(core_kernel_classes_Class $parent): array
    {
        $parentUris = [$parent->getUri()];

        while ($parentList = $parent->getParentClasses(false)) {
            $parent = current($parentList);
            if ($parent->getUri() === self::HIGHEST_PARENT_URI) {
                break;
            }
            $parentUris[] = $parent->getUri();
        }

        return $parentUris;
    }

    private function getPermissionProvider(): PermissionInterface
    {
        /** @noinspection PhpIncompatibleReturnTypeInspection */
        return $this->getServiceManager()->get(PermissionInterface::SERVICE_ID);
    }

    /**
     * @return User
     *
     * @throws common_exception_Error
     */
    private function getUser(): User
    {
        if ($this->user === null) {
            $this->user = $this
                ->getServiceManager()
                ->get(SessionService::SERVICE_ID)
                ->getCurrentUser();
        }

        return $this->user;
    }

    private function throwResourceAccessDeniedException(string $uri): void
    {
        $exception = new ResourceAccessDeniedException($uri);
        $this->getAdvancedLogger()->error(
            $exception->getMessage(),
            [ContextExtenderInterface::CONTEXT_EXCEPTION => $exception]
        );

        throw $exception;
    }

    private function getAdvancedLogger(): LoggerInterface
    {
        return $this->getServiceManager()->getContainer()->get(AdvancedLogger::ACL_SERVICE_ID);
    }

    private function getFeatureFlagChecker(): FeatureFlagCheckerInterface
    {
        return $this->getServiceManager()->getContainer()->get(FeatureFlagChecker::class);
    }

    private function getOntology(): Ontology
    {
        return $this->getServiceManager()->getContainer()->get(Ontology::SERVICE_ID);
    }
}
