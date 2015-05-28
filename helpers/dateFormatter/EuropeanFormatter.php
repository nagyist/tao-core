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
 * Copyright (c) 2015 (original work) Open Assessment Technologies SA;
 *               
 * 
 */

namespace oat\tao\helpers\dateFormatter;

use oat\oatbox\Configurable;
use DateTime;
use DateTimeZone;
use common_Logger;
use common_session_SessionManager;
/**
 * Utility to display dates.
 *
 * @author Joel Bout, <joel@taotesting.com>
 * @package tao
 *         
 */
class EuropeanFormatter extends Configurable implements Formatter
{

    public function format($timestamp, $dateFormat, $timeFormat)
    {
        $dateTime = new DateTime();
        $dateTime->setTimestamp($timestamp);
        $dateTime->setTimezone(new DateTimeZone(common_session_SessionManager::getSession()->getTimeZone()));
        
        $formatString = '';
        
        switch ($dateFormat) {
            case Formatter::LONG:
                $formatString .= 'F j, Y';
                break;
            case Formatter::SHORT:
                $formatString .= 'd/m/Y';
                break;
            case Formatter::NONE:
                break;
            default:
                \common_Logger::w('Unsupported date format: '.$dateFormat);
        }
        
        switch ($timeFormat) {
            case Formatter::MEDIUM:
                $formatString .= (empty($formatString) ? '' : ' '). 'H:i:s';
                break;
            case Formatter::SHORT:
                $formatString .= (empty($formatString) ? '' : ' '). 'H:i';
                break;
            default:
                \common_Logger::w('Unsupported time format: '.$timeFormat);
        }
        
        return $dateTime->format($formatString);
    }

}