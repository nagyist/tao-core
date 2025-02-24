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
 * Copyright (c) 2020-2022 (original work) Open Assessment Technologies SA;
 */

declare(strict_types=1);

namespace oat\tao\model\search;

use Exception;
use InvalidArgumentException;
use oat\generis\model\GenerisRdf;
use oat\generis\model\OntologyAwareTrait;
use oat\oatbox\service\ConfigurableService;
use oat\tao\model\AdvancedSearch\AdvancedSearchChecker;
use oat\tao\model\featureFlag\FeatureFlagChecker;
use oat\tao\model\featureFlag\FeatureFlagCheckerInterface;
use oat\tao\model\search\Contract\SearchSettingsServiceInterface;
use oat\tao\model\search\Service\DefaultSearchSettingsService;
use oat\tao\model\TaoOntology;
use Psr\Http\Message\ServerRequestInterface;
use tao_helpers_Uri;

class SearchProxy extends ConfigurableService implements Search
{
    use OntologyAwareTrait;

    public const OPTION_SEARCH_SETTINGS_SERVICE = 'search_settings_service';
    public const OPTION_ADVANCED_SEARCH_CLASS = 'advanced_search_class';
    public const OPTION_DEFAULT_SEARCH_CLASS = 'default_search_class';
    public const OPTION_GENERIS_SEARCH_WHITELIST = 'generis_search_whitelist';
    public const SAFE_NODES = [GenerisRdf::CLASS_ROLE];
    public const OPTION_FORCE_CRITERIA = 'force_criteria';

    public const GENERIS_SEARCH_DEFAULT_WHITELIST = [
        GenerisRdf::CLASS_ROLE,
        TaoOntology::CLASS_URI_TAO_USER,
        TaoOntology::CLASS_URI_TREE,
    ];

    private const IGNORE_CRITERIA_FOR_STRUCTURES = [
        'results',
    ];

    private const DISABLE_URI_SEARCH_FOR_ROOT_CLASSES = [
        'results',
    ];

    public function getAdvancedSearch(): ?SearchInterface
    {
        return $this->getService(self::OPTION_ADVANCED_SEARCH_CLASS);
    }

    public function getDefaultSearch(): SearchInterface
    {
        $defaultSearch = $this->getService(self::OPTION_DEFAULT_SEARCH_CLASS);

        if ($defaultSearch) {
            return $defaultSearch;
        }

        throw new InvalidArgumentException(sprintf('Option %s is required', self::OPTION_DEFAULT_SEARCH_CLASS));
    }

    public function withAdvancedSearch(SearchInterface $search): self
    {
        $this->setOption(self::OPTION_ADVANCED_SEARCH_CLASS, $search);

        return $this;
    }

    public function withDefaultSearch(SearchInterface $search): self
    {
        $this->setOption(self::OPTION_DEFAULT_SEARCH_CLASS, $search);

        return $this;
    }

    /**
     * @throws Exception
     */
    public function searchByQuery(SearchQuery $query): array
    {
        $results = $this->executeSearch($query);

        return $this->getResultSetResponseNormalizer()
            ->normalizeSafeClass($query, $results, '');
    }

    /**
     * @throws Exception
     */
    public function search(ServerRequestInterface $request): array
    {
        $query = $this->getQueryFactory()->create($request);
        $queryParams = $request->getQueryParams();
        $results = $this->executeSearch($query);

        if (
            isset($queryParams['params']['rootNode'])
            && in_array($queryParams['params']['rootNode'], self::SAFE_NODES, true)
        ) {
            return $this->getResultSetResponseNormalizer()
                ->normalizeSafeClass($query, $results, $queryParams['params']['structure']);
        }

        return $this->getResultSetResponseNormalizer()
            ->normalize($query, $results, $queryParams['params']['structure']);
    }

    /**
     * @inheritDoc
     */
    public function query($queryString, $type, $start = 0, $count = 10, $order = 'id', $dir = 'DESC')
    {
        return $this->getIndexSearch()->query($queryString, $type, $start, $count, $order, $dir);
    }

    /**
     * @inheritDoc
     */
    public function flush()
    {
        return $this->getIndexSearch()->flush();
    }

    /**
     * @inheritDoc
     */
    public function index($documents)
    {
        return $this->getIndexSearch()->index($documents);
    }

    /**
     * @inheritDoc
     */
    public function remove($resourceId)
    {
        return $this->getIndexSearch()->remove($resourceId);
    }

    /**
     * @inheritDoc
     */
    public function supportCustomIndex()
    {
        return $this->getAdvancedSearch() !== null;
    }

    public function extendGenerisSearchWhiteList(array $whiteList): void
    {
        $this->setOption(
            self::OPTION_GENERIS_SEARCH_WHITELIST,
            array_merge(
                $this->getOption(self::OPTION_GENERIS_SEARCH_WHITELIST, []),
                $whiteList
            )
        );
    }

    public function removeFromGenerisSearchWhiteList(array $whiteList): void
    {
        $this->setOption(
            self::OPTION_GENERIS_SEARCH_WHITELIST,
            array_diff(
                $this->getOption(self::OPTION_GENERIS_SEARCH_WHITELIST, []),
                $whiteList
            )
        );
    }

    public function getGenerisSearchUriWhitelist(): array
    {
        return array_merge(
            self::GENERIS_SEARCH_DEFAULT_WHITELIST,
            $this->getOption(self::OPTION_GENERIS_SEARCH_WHITELIST, [])
        );
    }

    public function getSearchSettingsService(): SearchSettingsServiceInterface
    {
        return $this->getServiceManager()
            ->getContainer()
            ->get($this->getOption(self::OPTION_SEARCH_SETTINGS_SERVICE) ?? DefaultSearchSettingsService::class);
    }

    private function executeSearch(SearchQuery $query): ResultSet
    {
        if ($query->isEmptySearch()) {
            return new ResultSet([], 0);
        }

        if ($this->allowIdentifierSearch($query)) {
            $result = $this->getIdentifierSearcher()->search($query);

            if ($result->getTotalCount() > 0) {
                return $result;
            }
        }

        $this->applySearchConditions($query);

        if ($this->isForcingDefaultSearch($query) || !$this->getAdvancedSearchChecker()->isEnabled()) {
            return $this->getDefaultSearch()->query(
                $query->getTerm(),
                $query->getParentClass(),
                $query->getStartRow(),
                $query->getRows()
            );
        }

        return $this->getAdvancedSearch()->query(
            $this->getAdvancedSearchQueryString($query),
            $query->getStructure(),
            $query->getStartRow(),
            $query->getRows(),
            $query->getSortBy(),
            $query->getSortOrder()
        );
    }

    private function getResultSetResponseNormalizer(): ResultSetResponseNormalizer
    {
        return $this->getServiceManager()->getContainer()->get(ResultSetResponseNormalizer::class);
    }

    private function getAdvancedSearchChecker(): AdvancedSearchChecker
    {
        return $this->getServiceManager()->getContainer()->get(AdvancedSearchChecker::class);
    }

    private function getIdentifierSearcher(): IdentifierSearcher
    {
        return $this->getServiceManager()->getContainer()->get(IdentifierSearcher::class);
    }

    private function getQueryFactory(): SearchQueryFactory
    {
        return $this->getServiceManager()->getContainer()->get(SearchQueryFactory::class);
    }

    private function getFeatureFlagChecker(): FeatureFlagCheckerInterface
    {
        return $this->getServiceManager()->getContainer()->get(FeatureFlagChecker::class);
    }

    private function isForcingDefaultSearch(SearchQuery $query): bool
    {
        return in_array($query->getRootClass(), $this->getGenerisSearchUriWhitelist(), true);
    }

    private function allowIdentifierSearch(SearchQuery $query): bool
    {
        return !in_array($query->getStructure(), self::DISABLE_URI_SEARCH_FOR_ROOT_CLASSES, true);
    }

    private function getIndexSearch(): SearchInterface
    {
        return $this->getAdvancedSearchChecker()->isEnabled()
            ? $this->getAdvancedSearch()
            : $this->getDefaultSearch();
    }

    private function getService(string $option): ?SearchInterface
    {
        if (!$this->hasOption($option)) {
            return null;
        }

        /** @var SearchInterface $search */
        $search = $this->getOption($option);

        if (is_string($search)) {
            return $this->getServiceManager()->getContainer()->get($search);
        }

        $this->propagate($search);

        return $search;
    }

    private function getAdvancedSearchQueryString(SearchQuery $query): string
    {
        if (in_array($query->getStructure(), self::IGNORE_CRITERIA_FOR_STRUCTURES, true)) {
            return $query->getTerm();
        }

        return sprintf(
            '%s AND parent_classes: "%s"',
            $query->getTerm(),
            $query->getParentClass()
        );
    }

    private function applySearchConditions(SearchQuery $query): void
    {
        if (
            $this->getFeatureFlagChecker()->isEnabled('FEATURE_FLAG_TRANSLATION_ENABLED') &&
            in_array($query->getRootClass(), [TaoOntology::CLASS_URI_ITEM, TaoOntology::CLASS_URI_TEST], true)
        ) {
            $typeUri = tao_helpers_Uri::encode(TaoOntology::PROPERTY_TRANSLATION_TYPE);
            $typeOriginalUri = tao_helpers_Uri::encode(TaoOntology::PROPERTY_VALUE_TRANSLATION_TYPE_ORIGINAL);

            $query->setTerm(sprintf('%s AND %s:%s', $query->getTerm(), $typeUri, $typeOriginalUri));
        }
    }
}
