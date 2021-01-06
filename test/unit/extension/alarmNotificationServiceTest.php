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
 * Copyright (c) 2020 (original work) Open Assessment Technologies SA (under the project TAO-PRODUCT);
 *
 */

declare(strict_types=1);

namespace oat\tao\test\unit\extension;

use common_exception_Error;
use oat\generis\test\TestCase;
use oat\oatbox\reporting\Report;
use oat\tao\model\event\TaoUpdateEvent;
use oat\tao\model\notifications\AlarmNotificationService;
use oat\tao\model\notifiers\NotifierInterface;

class alarmNotificationServiceTest extends TestCase
{
    public function setUp(): void
    {
        define('ROOT_URL', 'https://test.test.com');
    }

    /**
     * @throws common_exception_Error
     */
    public function testCheckReportErrorWithErrorReport()
    {
        $report = new common_report_Report(common_report_Report::TYPE_INFO, 'Report');
        $report->add(new common_report_Report(common_report_Report::TYPE_ERROR, 'Error report'));
        $report->add(new common_report_Report(common_report_Report::TYPE_WARNING, 'Warning report'));
        $report->add(new common_report_Report(common_report_Report::TYPE_INFO, 'Info report'));

        $notifierMock1 = $this->createMock(NotifierInterface::class);
        $expectedDescription1 = 'Error report' . PHP_EOL . 'Warning report' . PHP_EOL;
        $notifierMock1
            ->expects($this->once())
            ->method('notify')
            ->with('Tao notifications: ' . ROOT_URL, $expectedDescription1);

        $notifierMock2 = $this->createMock(NotifierInterface::class);
        $expectedDescription2 = 'Error report' . PHP_EOL;
        $notifierMock2
            ->expects($this->once())
            ->method('notify')
            ->with('Tao notifications: ' . ROOT_URL, $expectedDescription2);

        $updateNotifierService = new AlarmNotificationService();
        $updateNotifierService->setOption(AlarmNotificationService::OPTION_NOTIFIERS, [
            [
                'notifier' => $notifierMock1,
                'dispatchTypes' => [
                    common_report_Report::TYPE_WARNING,
                    common_report_Report::TYPE_ERROR
                ]
            ],
            [
                'notifier' => $notifierMock2,
                'dispatchTypes' => [
                    common_report_Report::TYPE_ERROR
                ]
            ]
        ]);
        $updateNotifierService->sendNotifications($report);
    }


}
