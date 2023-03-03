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
 * Copyright (c) 2017-2023 (original work) Open Assessment Technologies SA.
 */

declare(strict_types=1);

namespace oat\tao\test\unit\model\security\xsrf;

use oat\generis\test\ServiceManagerMockTrait;
use oat\oatbox\user\User;
use oat\generis\test\MockObject;
use oat\oatbox\session\SessionService;
use oat\tao\model\security\xsrf\Token;
use common_persistence_AdvKeyValuePersistence;
use oat\generis\persistence\PersistenceManager;
use oat\tao\model\security\xsrf\TokenStoreKeyValue;
use PHPUnit\Framework\TestCase;

class TokenStoreKeyValueTest extends TestCase
{
    use ServiceManagerMockTrait;

    private const PERSISTENCE_NAME = 'ADVANCED_KV_PERSISTENCE';
    private const USER_IDENTIFIER = 'CURRENT_USER_IDENTIFIER';
    private const TOKEN = 'TOKEN';
    private const KEY = self::USER_IDENTIFIER . '_' . TokenStoreKeyValue::TOKENS_STORAGE_KEY . '_' . self::TOKEN;
    private const COLLECTION_KEY = self::USER_IDENTIFIER . '_' .
    TokenStoreKeyValue::TOKENS_STORAGE_KEY . '_' .
    TokenStoreKeyValue::TOKENS_STORAGE_COLLECTION_KEY_SUFFIX;

    private TokenStoreKeyValue $subject;

    /** @var common_persistence_AdvKeyValuePersistence|MockObject */
    private common_persistence_AdvKeyValuePersistence $persistenceMock;

    protected function setUp(): void
    {
        $this->persistenceMock = $this->createMock(common_persistence_AdvKeyValuePersistence::class);

        $persistenceManagerMock = $this->createMock(PersistenceManager::class);
        $persistenceManagerMock
            ->method('getPersistenceById')
            ->with(self::PERSISTENCE_NAME)
            ->willReturn($this->persistenceMock);

        $userMock = $this->createMock(User::class);
        $userMock
            ->method('getIdentifier')
            ->willReturn(self::USER_IDENTIFIER);

        $sessionServiceMock = $this->createMock(SessionService::class);
        $sessionServiceMock
            ->method('getCurrentUser')
            ->willReturn($userMock);

        $this->subject = new TokenStoreKeyValue(['persistence' => self::PERSISTENCE_NAME]);
        $this->subject->setServiceManager(
            $this->getServiceManagerMock(
                [
                    PersistenceManager::SERVICE_ID => $persistenceManagerMock,
                    SessionService::SERVICE_ID => $sessionServiceMock,
                ]
            )
        );
    }

    public function testGetTokenWhenTokenExistsReturnToken(): void
    {
        $tokenData = [
            'token' => self::TOKEN,
            'ts' => 12345,
        ];

        $this->persistenceMock
            ->method('exists')
            ->with(self::KEY)
            ->willReturn(true);
        $this->persistenceMock
            ->method('get')
            ->with(self::KEY)
            ->willReturn(json_encode($tokenData));

        $result = $this->subject->getToken(self::TOKEN);

        $this->assertInstanceOf(
            Token::class,
            $result,
            'Method must return instance of Token.'
        );
        $this->assertSame(
            $tokenData['token'],
            $result->getValue(),
            'Token value must be as expected'
        );
        $this->assertSame(
            $tokenData['ts'],
            $result->getCreatedAt(),
            'Token createdAt value must be as expected'
        );
    }

    public function testGetTokenWhenTokenDontExistsReturnNull(): void
    {
        $this->persistenceMock
            ->method('get')
            ->willReturn(false);

        $this->assertNull(
            $this->subject->getToken('TOKEN_STRING'),
            'Method must return NULL if token not found.'
        );
    }

    public function testSetToken(): void
    {
        $token = $this->createMock(Token::class);
        $token
            ->method('jsonSerialize')
            ->willReturn([]);

        $this->persistenceMock
            ->method('set')
            ->withConsecutive(
                [
                    self::KEY, json_encode($token)
                ],
                [
                    self::COLLECTION_KEY, json_encode(['ABC', self::KEY]),
                ]
            );

        $this->persistenceMock
            ->expects($this->once())
            ->method('get')
            ->with(self::COLLECTION_KEY)
            ->willReturn('["ABC"]');

        $this->subject->setToken(self::TOKEN, $token);
    }

    public function testHasTokenWhenTokenExistsThenReturnTrue(): void
    {
        $this->persistenceMock
            ->method('exists')
            ->with(self::KEY)
            ->willReturn(true);

        $this->assertTrue(
            $this->subject->hasToken(self::TOKEN),
            'Method must return TRUE if token exists.'
        );
    }

    public function testHasTokenWhenTokenDontExistsThenReturnFalse(): void
    {
        $this->persistenceMock
            ->method('exists')
            ->with(self::KEY)
            ->willReturn(false);

        $this->assertFalse(
            $this->subject->hasToken(self::TOKEN),
            'Method must return FALSE if token does not exists.'
        );
    }

    public function testRemoveTokenWhenTokenWasRemovedThenReturnTrue(): void
    {
        $this->persistenceMock
            ->expects($this->once())
            ->method('get')
            ->with(self::COLLECTION_KEY)
            ->willReturn(json_encode([self::KEY]));

        $this->persistenceMock
            ->method('set')
            ->with(self::COLLECTION_KEY, json_encode([]));

        $this->persistenceMock
            ->method('del')
            ->with(self::KEY)
            ->willReturn(true);

        $this->assertTrue(
            $this->subject->removeToken(self::TOKEN),
            'Method must return TRUE when token removed.'
        );
    }

    public function testRemoveTokenWhenTokenWasNotRemovedThenReturnFalse(): void
    {
        $this->persistenceMock
            ->expects($this->once())
            ->method('get')
            ->with(self::COLLECTION_KEY)
            ->willReturn(json_encode([self::KEY]));

        $this->persistenceMock
            ->method('set')
            ->with(self::COLLECTION_KEY, json_encode([]));

        $this->persistenceMock
            ->method('del')
            ->with(self::KEY)
            ->willReturn(false);

        $this->assertFalse(
            $this->subject->removeToken(self::TOKEN),
            'Method must return FALSE when token was not removed.'
        );
    }

    public function testRemoveTokenWhenTokenDoesNotExistsThenReturnFalse(): void
    {
        $this->persistenceMock
            ->expects($this->once())
            ->method('get')
            ->with(self::COLLECTION_KEY)
            ->willReturn(json_encode([]));

        $this->persistenceMock
            ->method('del')
            ->with(self::KEY)
            ->willReturn(false);

        $this->assertFalse(
            $this->subject->removeToken(self::TOKEN),
            'Method must return FALSE when token does not exist.'
        );
    }

    public function testClearWhenThereAreTokensStoredRemoveAllTokens(): void
    {
        $this->persistenceMock
            ->expects($this->once())
            ->method('get')
            ->with(self::COLLECTION_KEY)
            ->willReturn(json_encode([self::KEY]));

        $this->persistenceMock
            ->method('del')
            ->withConsecutive(
                [
                    self::KEY,
                ],
                [
                    self::COLLECTION_KEY,
                ]
            );

        $this->subject->clear();
    }

    public function testGetAllWithSuccess(): void
    {
        $jsonToken1 = '{"token": "TOKEN_VALUE_1","ts":12345}';
        $jsonToken2 = '{"token": "TOKEN_VALUE_2","ts":6789}';
        $tokensData = [
            'TOKEN_ID_1' => $jsonToken1,
            'TOKEN_ID_2' => $jsonToken2,
        ];

        $this->persistenceMock
            ->method('get')
            ->willReturnCallback(
                static function (string $key) use ($tokensData): string {
                    if ($key === self::COLLECTION_KEY) {
                        return json_encode(
                            [
                                'TOKEN_ID_1',
                                'TOKEN_ID_2',
                            ]
                        );
                    }

                    return $tokensData[$key];
                }
            );

        $this->assertEquals(
            [
                new Token(json_decode($jsonToken1, true)),
                new Token(json_decode($jsonToken2, true)),
            ],
            $this->subject->getAll()
        );
    }

    public function testGetAllWillReturnEmptyWhenNoStoredTokens(): void
    {
        $this->persistenceMock
            ->method('get')
            ->willReturn(json_encode([]));

        $this->assertEquals([], $this->subject->getAll());
    }

    public function testGetAllWithReturnEmptyWhenInvalidKey(): void
    {
        $this->persistenceMock
            ->method('get')
            ->willReturnCallback(
                static function (string $key) {
                    if ($key === self::COLLECTION_KEY) {
                        return json_encode(['TOKEN_ID_1']);
                    }

                    return false;
                }
            );

        $this->assertEquals([], $this->subject->getAll());
    }
}
