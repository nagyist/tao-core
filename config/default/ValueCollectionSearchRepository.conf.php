<?php

/**
 * Default config header created during install
 */

use oat\oatbox\service\ServiceFactoryInterface;
use Zend\ServiceManager\ServiceLocatorInterface;

return new class implements ServiceFactoryInterface {
    public function __invoke(ServiceLocatorInterface $serviceLocator)
    {
        return new oat\tao\model\Lists\DataAccess\Repository\RdfValueCollectionSearchRepository(
            $serviceLocator->get(oat\generis\persistence\PersistenceManager::SERVICE_ID),
            'default'
        );
    }
};
