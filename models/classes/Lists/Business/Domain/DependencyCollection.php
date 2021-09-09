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
 * Copyright (c) 2021 (original work) Open Assessment Technologies SA;
 */

declare(strict_types=1);

namespace oat\tao\model\Lists\Business\Domain;

use ArrayIterator;
use JsonSerializable;

class DependencyCollection extends ArrayIterator implements JsonSerializable
{
    public function getListUris(): array
    {
        //@TODO FIXME Check if those are listUris or we should rename the method
        $list = [];

        /** @var Dependency $value */
        foreach ($this->getArrayCopy() as $value) {
            $list[] = $value->getValue();
        }

        return $list;
    }

    public function jsonSerialize(): array
    {
        return $this->getArrayCopy();
    }
}
